import { describe, it, expect, vi } from "vitest"
import React from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import {
  PageFrame,
  PartyBlock,
  ItemsTable,
  TotalsBlock,
  PdfHeader,
  PDF_DARK,
  PDF_ON_DARK,
  PDF_ACCENT,
  PDF_ON_ACCENT,
  PDF_ACCENT_SOFT,
  type PdfLineItem,
} from "../primitives"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"
import { extractPdfText, containsNormalized, normalize } from "./_pdf-text"

vi.mock("server-only", () => ({}))

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

const billFromWithLogo: BillFrom = {
  ...fullBillFrom,
  logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
}

describe("PartyBlock logo rendering", () => {
  it("party_block_renders_image_when_logo_url_present", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PartyBlock, { label: "Emetteur", party: billFromWithLogo }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer).toBeDefined()
    expect(buffer.length).toBeGreaterThan(0)
  })

  it("party_block_renders_without_image_when_no_logo_url", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PartyBlock, { label: "Emetteur", party: fullBillFrom }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer).toBeDefined()
    expect(buffer.length).toBeGreaterThan(0)
  })
})

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
    await expect(renderToBuffer(element as React.ReactElement<DocumentProps>)).resolves.toBeDefined()
  })
})

describe("PdfHeader palette", () => {
  it("pdf_palette_constants_are_hex_strings", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    expect(hexPattern.test(PDF_DARK)).toBe(true)
    expect(hexPattern.test(PDF_ON_DARK)).toBe(true)
    expect(hexPattern.test(PDF_ACCENT)).toBe(true)
    expect(hexPattern.test(PDF_ON_ACCENT)).toBe(true)
  })

  it("pdf_accent_soft_is_valid_hex", () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/
    expect(hexPattern.test(PDF_ACCENT_SOFT)).toBe(true)
  })
})

describe("PdfHeader rendering", () => {
  it("pdf_header_renders_valid_pdf_with_logo", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PdfHeader, {
        docType: "FACTURE",
        logoUrl: billFromWithLogo.logoUrl,
        emitterName: "Acme SAS",
      }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.slice(0, 4).toString()).toBe("%PDF")
  })

  it("pdf_header_renders_without_logo_when_absent", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PdfHeader, {
        docType: "DEVIS",
        emitterName: "Acme SAS",
      }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.slice(0, 4).toString()).toBe("%PDF")
    const text = await extractPdfText(element)
    expect(normalize(text)).not.toContain("undefined")
  })

  it("pdf_header_renders_without_number_prop", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PdfHeader, {
        docType: "FACTURE",
        emitterName: "Test Corp",
      }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-")
    const text = await extractPdfText(element)
    expect(containsNormalized(text, "FACTURE")).toBe(true)
  })

  it("pdf_header_renders_with_logo_inline", async () => {
    const element = React.createElement(
      PageFrame,
      null,
      React.createElement(PdfHeader, {
        docType: "DEVIS",
        logoUrl: billFromWithLogo.logoUrl,
        emitterName: "Acme SAS",
      }),
    )
    const buffer = await renderToBuffer(element as React.ReactElement<DocumentProps>)
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-")
    const text = await extractPdfText(element)
    expect(containsNormalized(text, "Acme SAS")).toBe(true)
    expect(containsNormalized(text, "DEVIS")).toBe(true)
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
