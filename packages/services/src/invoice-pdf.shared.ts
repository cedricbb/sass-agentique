import type { BillFrom, BillTo } from "./billing-party.shared"
import { computeInvoiceTtc } from "./invoice.shared"

export type InvoiceForPdf = {
  number: string
  status: string
  issuedAt: Date | null
  dueAt: Date | null
  totalEurCents: number
  vatRateBps: number
  notes?: string | null
}

export type InvoiceItemForPdf = {
  description: string
  quantity: number
  unitPriceEurCents: number
  sortOrder: number
}

export type PdfLineItem = {
  description: string
  quantity: number
  unitPriceHtCents: number
  totalHtCents: number
}

export type InvoicePdfModel = {
  number: string
  status: string
  issuedAt: Date | null
  dueAt: Date | null
  billFrom: BillFrom
  billTo: BillTo
  items: PdfLineItem[]
  totalHtCents: number
  vatCents: number
  totalTtcCents: number
  notes?: string | null
}

export function toInvoicePdfModel(input: {
  invoice: InvoiceForPdf
  items: InvoiceItemForPdf[]
  billFrom: BillFrom
  billTo: BillTo
}): InvoicePdfModel {
  const sortedItems = [...input.items].sort((a, b) => a.sortOrder - b.sortOrder)
  const lineItems: PdfLineItem[] = sortedItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceHtCents: item.unitPriceEurCents,
    totalHtCents: item.quantity * item.unitPriceEurCents,
  }))
  const amounts = computeInvoiceTtc({
    totalEurCents: input.invoice.totalEurCents,
    vatRateBps: input.invoice.vatRateBps,
  })
  return {
    number: input.invoice.number,
    status: input.invoice.status,
    issuedAt: input.invoice.issuedAt,
    dueAt: input.invoice.dueAt,
    billFrom: input.billFrom,
    billTo: input.billTo,
    items: lineItems,
    totalHtCents: amounts.totalHtCents,
    vatCents: amounts.vatCents,
    totalTtcCents: amounts.totalTtcCents,
    notes: input.invoice.notes,
  }
}
