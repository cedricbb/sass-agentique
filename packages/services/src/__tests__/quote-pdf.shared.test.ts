import { describe, it, expect } from "vitest"
import { toQuotePdfModel } from "../quote-pdf.shared"
import type { BillFrom, BillTo } from "../billing-party.shared"

const billFrom: BillFrom = {
  name: "Acme SAS",
  address: { line1: "12 rue des Lilas", city: "Paris", zip: "75001", country: "France" },
}

const billTo: BillTo = {
  name: "Jean Dupont",
  type: "individual",
  address: { line1: "5 avenue de la Gare", city: "Lyon" },
}

const baseQuote = {
  number: "DEV-001",
  status: "Envoyé",
  issuedAt: new Date("2024-01-01"),
  expiresAt: new Date("2024-02-01"),
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
}

describe("toQuotePdfModel", () => {
  it("sorts_items_by_sort_order", () => {
    const items = [
      { description: "C", quantity: 1, unitPriceEurCents: 1000, sortOrder: 10 },
      { description: "A", quantity: 1, unitPriceEurCents: 2000, sortOrder: 1 },
      { description: "B", quantity: 1, unitPriceEurCents: 1500, sortOrder: 5 },
    ]
    const model = toQuotePdfModel({ quote: baseQuote, items, billFrom, billTo })
    expect(model.items[0].description).toBe("A")
    expect(model.items[1].description).toBe("B")
    expect(model.items[2].description).toBe("C")
  })

  it("computes_line_item_totals", () => {
    const items = [
      { description: "Prestation", quantity: 3, unitPriceEurCents: 5000, sortOrder: 0 },
    ]
    const model = toQuotePdfModel({ quote: baseQuote, items, billFrom, billTo })
    expect(model.items[0].unitPriceHtCents).toBe(5000)
    expect(model.items[0].totalHtCents).toBe(15000)
  })

  it("computes_model_totals_via_compute_quote_ttc", () => {
    const model = toQuotePdfModel({
      quote: { ...baseQuote, totalEurCents: 10000, vatRateBps: 2000 },
      items: [],
      billFrom,
      billTo,
    })
    expect(model.totalHtCents).toBe(10000)
    expect(model.vatCents).toBe(2000)
    expect(model.totalTtcCents).toBe(12000)
  })

  it("preserves_notes_or_null", () => {
    const withNull = toQuotePdfModel({ quote: { ...baseQuote, notes: null }, items: [], billFrom, billTo })
    expect(withNull.notes).toBeNull()

    const withText = toQuotePdfModel({ quote: { ...baseQuote, notes: "Texte libre" }, items: [], billFrom, billTo })
    expect(withText.notes).toBe("Texte libre")
  })

  it("preserves_null_dates", () => {
    const model = toQuotePdfModel({
      quote: { ...baseQuote, issuedAt: null, expiresAt: null },
      items: [],
      billFrom,
      billTo,
    })
    expect(model.issuedAt).toBeNull()
    expect(model.expiresAt).toBeNull()
  })
})
