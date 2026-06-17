import { describe, it, expect, vi } from "vitest"
import { renderInvoicePdf } from "../render"
import { toInvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import { decompressPdfStreams, decodePdfHexStrings, containsNormalized } from "./_pdf-text"
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

describe("renderInvoicePdf", () => {
  it("render_invoice_pdf_produces_valid_pdf_with_content", async () => {
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-001",
        status: "Envoyée",
        issuedAt: new Date("2024-01-01"),
        dueAt: new Date("2024-01-31"),
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

    const buffer = await renderInvoicePdf(model)
    expect(buffer.slice(0, 5).toString()).toBe("%PDF-")

    const decompressed = decompressPdfStreams(buffer)
    const text = decodePdfHexStrings(decompressed)
    expect(containsNormalized(text, "INV-2024-001")).toBe(true)
    expect(containsNormalized(text, "Acme SAS")).toBe(true)
    expect(containsNormalized(text, "120.00")).toBe(true)
  })
})
