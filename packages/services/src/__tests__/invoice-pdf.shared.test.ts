import { describe, it, expect } from "vitest"
import { toInvoicePdfModel } from "../invoice-pdf.shared"
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

const baseInvoice = {
  number: "INV-001",
  status: "Envoyée",
  issuedAt: new Date("2024-01-01"),
  dueAt: new Date("2024-01-31"),
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
}

describe("toInvoicePdfModel", () => {
  it("sorts_items_by_sort_order", () => {
    const items = [
      { description: "C", quantity: 1, unitPriceEurCents: 1000, sortOrder: 2 },
      { description: "A", quantity: 1, unitPriceEurCents: 2000, sortOrder: 0 },
      { description: "B", quantity: 1, unitPriceEurCents: 1500, sortOrder: 1 },
    ]
    const model = toInvoicePdfModel({ invoice: baseInvoice, items, billFrom, billTo })
    expect(model.items[0].description).toBe("A")
    expect(model.items[1].description).toBe("B")
    expect(model.items[2].description).toBe("C")
  })

  it("computes_line_item_totals", () => {
    const items = [
      { description: "Prestation", quantity: 3, unitPriceEurCents: 5000, sortOrder: 0 },
    ]
    const model = toInvoicePdfModel({ invoice: baseInvoice, items, billFrom, billTo })
    expect(model.items[0].unitPriceHtCents).toBe(5000)
    expect(model.items[0].totalHtCents).toBe(15000)
  })

  it("computes_model_totals_via_compute_invoice_ttc", () => {
    const model = toInvoicePdfModel({
      invoice: { ...baseInvoice, totalEurCents: 10000, vatRateBps: 2000 },
      items: [],
      billFrom,
      billTo,
    })
    expect(model.totalHtCents).toBe(10000)
    expect(model.vatCents).toBe(2000)
    expect(model.totalTtcCents).toBe(12000)
  })

  it("handles_empty_items_array", () => {
    const model = toInvoicePdfModel({ invoice: baseInvoice, items: [], billFrom, billTo })
    expect(model.items).toEqual([])
    expect(model.totalHtCents).toBe(10000)
  })

  it("preserves_notes_or_null", () => {
    const withNull = toInvoicePdfModel({ invoice: { ...baseInvoice, notes: null }, items: [], billFrom, billTo })
    expect(withNull.notes).toBeNull()

    const withText = toInvoicePdfModel({ invoice: { ...baseInvoice, notes: "Texte libre" }, items: [], billFrom, billTo })
    expect(withText.notes).toBe("Texte libre")
  })

  it("preserves_null_dates", () => {
    const model = toInvoicePdfModel({
      invoice: { ...baseInvoice, issuedAt: null, dueAt: null },
      items: [],
      billFrom,
      billTo,
    })
    expect(model.issuedAt).toBeNull()
    expect(model.dueAt).toBeNull()
  })
})
