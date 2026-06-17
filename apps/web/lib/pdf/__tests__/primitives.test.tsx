import { describe, it, expect, vi } from "vitest"
import React from "react"
import { inflateSync } from "zlib"
import { renderToBuffer } from "@react-pdf/renderer"
import {
  PageFrame,
  PartyBlock,
  ItemsTable,
  TotalsBlock,
  type PdfLineItem,
} from "../primitives"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"

vi.mock("server-only", () => ({}))

function decodePdfHexStrings(content: string): string {
  const hexPattern = /<([0-9a-fA-F]{2,})>/g
  const parts: string[] = []
  let match: RegExpExecArray | null
  while ((match = hexPattern.exec(content)) !== null) {
    const hex = match[1]
    let decoded = ""
    for (let i = 0; i + 1 < hex.length; i += 2) {
      const code = parseInt(hex.slice(i, i + 2), 16)
      if (code >= 0x20 && code <= 0x7e) {
        decoded += String.fromCharCode(code)
      }
    }
    if (decoded) parts.push(decoded)
  }
  return parts.join("")
}

function decompressPdfStreams(pdfBuffer: Buffer): string {
  const pdfLatin = pdfBuffer.toString("latin1")
  const decompressedParts: string[] = []
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamPattern.exec(pdfLatin)) !== null) {
    try {
      const compressed = Buffer.from(match[1], "latin1")
      const decompressed = inflateSync(compressed)
      decompressedParts.push(decompressed.toString("latin1"))
    } catch {
    }
  }
  return decompressedParts.join("\n")
}

function normalize(s: string): string {
  return s.replace(/\s+/g, "")
}

async function extractPdfText(element: React.ReactElement): Promise<string> {
  const buffer = await renderToBuffer(element)
  const decompressed = decompressPdfStreams(buffer)
  return decodePdfHexStrings(decompressed)
}

function containsNormalized(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle))
}

const fullBillFrom: BillFrom = {
  name: "Acme SAS",
  legalForm: "SAS",
  address: {
    line1: "12 rue des Lilas",
    city: "Paris",
    zip: "75001",
    country: "France",
  },
  email: "contact@acme.fr",
  phone: "+33 1 23 45 67 89",
  siret: "123 456 789 00012",
  tvaIntra: "FR12345678900",
}

const minimalBillTo: BillTo = {
  name: "Jean Dupont",
  type: "individual",
  address: {
    line1: "5 avenue de la Gare",
    city: "Lyon",
  },
}

describe("PartyBlock", () => {
  it("party_block_renders_all_fields_of_full_bill_from", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PartyBlock, { label: "Emetteur", party: fullBillFrom }),
    )
    const text = await extractPdfText(element)
    expect(containsNormalized(text, "Acme SAS")).toBe(true)
    expect(containsNormalized(text, "12 rue des Lilas")).toBe(true)
    expect(containsNormalized(text, "contact@acme.fr")).toBe(true)
    expect(containsNormalized(text, "123 456 789 00012")).toBe(true)
    expect(containsNormalized(text, "FR12345678900")).toBe(true)
  })

  it("party_block_renders_minimal_bill_to_without_undefined", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PartyBlock, { label: "Destinataire", party: minimalBillTo }),
    )
    const text = await extractPdfText(element)
    expect(containsNormalized(text, "Jean Dupont")).toBe(true)
    expect(normalize(text)).not.toContain("undefined")
    expect(normalize(text)).not.toContain("null")
  })
})

describe("ItemsTable", () => {
  it("items_table_renders_items_with_formatted_amounts", async () => {
    const items: PdfLineItem[] = [
      { description: "Prestation alpha", quantity: 2, unitPriceHtCents: 15000, totalHtCents: 30000 },
      { description: "Forfait beta", quantity: 1, unitPriceHtCents: 5050, totalHtCents: 5050 },
    ]
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(ItemsTable, { items }),
    )
    const text = await extractPdfText(element)
    expect(containsNormalized(text, "Prestation alpha")).toBe(true)
    expect(containsNormalized(text, "Forfait beta")).toBe(true)
    expect(normalize(text)).toContain("150.00")
    expect(normalize(text)).toContain("300.00")
    expect(normalize(text)).toContain("50.50")
  })

  it("items_table_renders_empty_array_without_throwing", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(ItemsTable, { items: [] }),
    )
    await expect(renderToBuffer(element)).resolves.toBeDefined()
  })
})

describe("TotalsBlock", () => {
  it("totals_block_renders_formatted_amounts", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(TotalsBlock, {
        totalHtCents: 10000,
        vatCents: 2000,
        totalTtcCents: 12000,
      }),
    )
    const text = await extractPdfText(element)
    expect(normalize(text)).toContain("100.00")
    expect(normalize(text)).toContain("20.00")
    expect(normalize(text)).toContain("120.00")
  })
})
