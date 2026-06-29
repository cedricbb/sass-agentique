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
    expect(containsNormalized(text, "FACTURE")).toBe(true)
    expect(containsNormalized(text, "Acme SAS")).toBe(true)
    expect(containsNormalized(text, "Jean Dupont")).toBe(true)
    expect(containsNormalized(text, "120,00")).toBe(true)
  })

  it("render_invoice_pdf_dates_in_fr_format", async () => {
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-DATE",
        status: "Envoyée",
        issuedAt: new Date("2024-01-15"),
        dueAt: new Date("2024-02-15"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo,
    })

    const buffer = await renderInvoicePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "15/01/2024")).toBe(true)
  })

  it("render_invoice_pdf_does_not_contain_emitter_block", async () => {
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-002",
        status: "Envoyée",
        issuedAt: new Date("2024-01-01"),
        dueAt: new Date("2024-01-31"),
        totalEurCents: 5000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [
        { description: "Service test", quantity: 1, unitPriceEurCents: 5000, sortOrder: 0 },
      ],
      billFrom,
      billTo,
    })

    const buffer = await renderInvoicePdf(model)
    const decompressed = decompressPdfStreams(buffer)
    const text = decodePdfHexStrings(decompressed)
    expect(containsNormalized(text, "metteur")).toBe(false)
  })

  it("render_invoice_pdf_attention_line", async () => {
    const billToWithAttention: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      attention: "Marie Martin",
    }
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-ATT",
        status: "Envoyée",
        issuedAt: new Date("2024-01-01"),
        dueAt: new Date("2024-01-31"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithAttention,
    })
    const buffer = await renderInvoicePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "attention de")).toBe(true)
    expect(containsNormalized(text, "Marie Martin")).toBe(true)
  })

  it("render_invoice_pdf_siret_line", async () => {
    const billToWithSiret: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      siret: "12345678901234",
    }
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-SIRET",
        status: "Envoyée",
        issuedAt: new Date("2024-01-01"),
        dueAt: new Date("2024-01-31"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithSiret,
    })
    const buffer = await renderInvoicePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "SIRET")).toBe(true)
    expect(containsNormalized(text, "12345678901234")).toBe(true)
  })

  it("render_invoice_pdf_tva_intra_line", async () => {
    const billToWithTva: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      tvaIntra: "FR12345678901",
    }
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-TVA",
        status: "Envoyée",
        issuedAt: new Date("2024-01-01"),
        dueAt: new Date("2024-01-31"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithTva,
    })
    const buffer = await renderInvoicePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "TVA")).toBe(true)
    expect(containsNormalized(text, "FR12345678901")).toBe(true)
  })

  it("render_invoice_pdf_minimal_billto_no_undefined", async () => {
    const minimalBillTo: BillTo = {
      name: "Client Simple",
      type: "individual",
      address: {},
    }
    const model = toInvoicePdfModel({
      invoice: {
        number: "INV-2024-003",
        status: "Brouillon",
        issuedAt: new Date("2024-01-01"),
        dueAt: null,
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [
        { description: "Item test", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 },
      ],
      billFrom,
      billTo: minimalBillTo,
    })

    const buffer = await renderInvoicePdf(model)
    const decompressed = decompressPdfStreams(buffer)
    const text = decodePdfHexStrings(decompressed)
    expect(containsNormalized(text, "undefined")).toBe(false)
    expect(containsNormalized(text, "null")).toBe(false)
    expect(containsNormalized(text, "SIRET")).toBe(false)
    expect(containsNormalized(text, "TVA :")).toBe(false)
    expect(containsNormalized(text, "attention de")).toBe(false)
  })
})
