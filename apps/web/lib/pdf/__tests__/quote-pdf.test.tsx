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
  it("render_quote_pdf_attention_line", async () => {
    const billToWithAttention: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      attention: "Marie Martin",
    }
    const model = toQuotePdfModel({
      quote: {
        number: "DEV-2024-ATT",
        status: "Envoyé",
        issuedAt: new Date("2024-01-01"),
        expiresAt: new Date("2024-02-01"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithAttention,
    })
    const buffer = await renderQuotePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "attention de")).toBe(true)
    expect(containsNormalized(text, "Marie Martin")).toBe(true)
  })

  it("render_quote_pdf_siret_line", async () => {
    const billToWithSiret: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      siret: "12345678901234",
    }
    const model = toQuotePdfModel({
      quote: {
        number: "DEV-2024-SIRET",
        status: "Envoyé",
        issuedAt: new Date("2024-01-01"),
        expiresAt: new Date("2024-02-01"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithSiret,
    })
    const buffer = await renderQuotePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "SIRET")).toBe(true)
    expect(containsNormalized(text, "12345678901234")).toBe(true)
  })

  it("render_quote_pdf_tva_intra_line", async () => {
    const billToWithTva: BillTo = {
      name: "Dupont SARL",
      type: "company",
      address: { city: "Paris" },
      tvaIntra: "FR12345678901",
    }
    const model = toQuotePdfModel({
      quote: {
        number: "DEV-2024-TVA",
        status: "Envoyé",
        issuedAt: new Date("2024-01-01"),
        expiresAt: new Date("2024-02-01"),
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: billToWithTva,
    })
    const buffer = await renderQuotePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "TVA")).toBe(true)
    expect(containsNormalized(text, "FR12345678901")).toBe(true)
  })

  it("render_quote_pdf_no_optional_fields_no_labels", async () => {
    const minimalBillTo: BillTo = {
      name: "Client Simple",
      type: "individual",
      address: {},
    }
    const model = toQuotePdfModel({
      quote: {
        number: "DEV-2024-MIN",
        status: "Brouillon",
        issuedAt: new Date("2024-01-01"),
        expiresAt: null,
        totalEurCents: 1000,
        vatRateBps: 2000,
        notes: null,
      },
      items: [{ description: "Item test", quantity: 1, unitPriceEurCents: 1000, sortOrder: 0 }],
      billFrom,
      billTo: minimalBillTo,
    })
    const buffer = await renderQuotePdf(model)
    const text = decodePdfHexStrings(decompressPdfStreams(buffer))
    expect(containsNormalized(text, "SIRET")).toBe(false)
    expect(containsNormalized(text, "TVA :")).toBe(false)
    expect(containsNormalized(text, "attention de")).toBe(false)
  })

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
