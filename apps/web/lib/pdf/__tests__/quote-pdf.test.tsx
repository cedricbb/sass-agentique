import { describe, it, expect, vi } from "vitest"
import { renderQuotePdf } from "../render"
import { toQuotePdfModel } from "@saas/services/quote-pdf.shared"
import { decompressPdfStreams, decodePdfHexStrings, containsNormalized, normalize } from "./_pdf-text"
import type { BillFrom, BillTo } from "@saas/services/billing-party.shared"

vi.mock("server-only", () => ({}))

const billFrom: BillFrom = {
  name: "Acme SAS",
  address: { line1: "12 rue des Lilas", city: "Paris", zip: "75001", country: "France" },
}

const billTo: BillTo = {
  name: "Jean Dupont",
  type: "individual",
  address: { city: "Lyon" },
}

describe("renderQuotePdf", () => {
  it("render_quote_pdf_produces_valid_pdf_with_content", async () => {
    const model = toQuotePdfModel({
      quote: {
        number: "DEV-2024-001",
        status: "Envoyé",
        issuedAt: new Date("2024-01-01"),
        expiresAt: new Date("2024-02-01"),
        totalEurCents: 10000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [
        { description: "Prestation conseil", quantity: 2, unitPriceEurCents: 5000, sortOrder: 0 },
      ],
      billFrom,
      billTo,
    })

    const buffer = await renderQuotePdf(model)
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-")

    const decompressed = decompressPdfStreams(buffer)
    const text = decodePdfHexStrings(decompressed)
    expect(containsNormalized(text, "DEV-2024-001")).toBe(true)
    expect(containsNormalized(text, "DEVIS")).toBe(true)
    expect(containsNormalized(text, "Acme SAS")).toBe(true)
    expect(containsNormalized(text, "Jean Dupont")).toBe(true)
    expect(normalize(text)).toContain("validit")
  })
})
