import type { BillFrom, BillTo } from "./billing-party.shared"
import { computeQuoteTtc } from "./quote.shared"

export type QuoteForPdf = {
  number: string
  status: string
  issuedAt: Date | null
  expiresAt: Date | null
  totalEurCents: number
  vatRateBps: number
  notes?: string | null
}

export type QuoteItemForPdf = {
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

export type QuotePdfModel = {
  number: string
  status: string
  issuedAt: Date | null
  expiresAt: Date | null
  billFrom: BillFrom
  billTo: BillTo
  items: PdfLineItem[]
  totalHtCents: number
  vatCents: number
  totalTtcCents: number
  notes?: string | null
}

export function toQuotePdfModel(input: {
  quote: QuoteForPdf
  items: QuoteItemForPdf[]
  billFrom: BillFrom
  billTo: BillTo
}): QuotePdfModel {
  const sortedItems = [...input.items].sort((a, b) => a.sortOrder - b.sortOrder)
  const lineItems: PdfLineItem[] = sortedItems.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPriceHtCents: item.unitPriceEurCents,
    totalHtCents: item.quantity * item.unitPriceEurCents,
  }))
  const amounts = computeQuoteTtc({
    totalEurCents: input.quote.totalEurCents,
    vatRateBps: input.quote.vatRateBps,
  })
  return {
    number: input.quote.number,
    status: input.quote.status,
    issuedAt: input.quote.issuedAt,
    expiresAt: input.quote.expiresAt,
    billFrom: input.billFrom,
    billTo: input.billTo,
    items: lineItems,
    totalHtCents: amounts.totalHtCents,
    vatCents: amounts.vatCents,
    totalTtcCents: amounts.totalTtcCents,
    notes: input.quote.notes,
  }
}
