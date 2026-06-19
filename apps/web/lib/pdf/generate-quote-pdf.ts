import "server-only"
import type { BusinessProfile } from "@saas/db"
import {
  getQuoteById,
  listQuoteItems,
  getClientById,
  getBusinessProfile,
  setQuotePdfKey,
} from "@saas/services"
import {
  resolveBillingParty,
  resolveEmitter,
  parseAddressJsonb,
  type EmitterInput,
} from "@saas/services/billing-party.shared"
import { toQuotePdfModel } from "@saas/services/quote-pdf.shared"
import {
  buildQuoteKey,
  uploadPdfToR2,
  deletePdfFromR2,
  isPdfMagicBytes,
  assertPdfSize,
  InvalidPdfMagicBytesError,
} from "@/lib/storage/r2"
import { renderQuotePdf } from "./render"
import {
  BusinessProfileRequiredError,
  ClientNotFoundError,
  resolveEmitterLogoDataUri,
} from "./generate-invoice-pdf"

export class QuoteNotFoundError extends Error {
  constructor(quoteId: string) {
    super(`Quote not found: ${quoteId}`)
    this.name = "QuoteNotFoundError"
  }
}

export { BusinessProfileRequiredError, ClientNotFoundError }

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  declined: "Refusé",
  expired: "Expiré",
}

function resolveQuoteStatusLabel(status: string): string {
  return QUOTE_STATUS_LABELS[status] ?? status
}

function toEmitterInput(profile: BusinessProfile): EmitterInput {
  return {
    name: profile.name,
    legalForm: profile.legalForm ?? undefined,
    siret: profile.siret ?? undefined,
    tvaIntra: profile.tvaIntra ?? undefined,
    address: parseAddressJsonb(profile.address),
    email: profile.email ?? undefined,
    phone: profile.phone ?? undefined,
  }
}

export async function generateAndStoreQuotePdf(quoteId: string): Promise<{ pdfKey: string }> {
  const quote = await getQuoteById(quoteId)
  if (!quote) throw new QuoteNotFoundError(quoteId)

  if (quote.pdfKey != null) return { pdfKey: quote.pdfKey }

  const [items, client, profile] = await Promise.all([
    listQuoteItems(quoteId),
    getClientById(quote.clientId),
    getBusinessProfile(quote.ownerId),
  ])

  if (!client) throw new ClientNotFoundError(quote.clientId)
  if (!profile) throw new BusinessProfileRequiredError(quote.ownerId)

  const billTo = resolveBillingParty(client)
  const logoUrl = await resolveEmitterLogoDataUri(profile)
  const billFrom = resolveEmitter({ ...toEmitterInput(profile), logoUrl })
  const statusLabel = resolveQuoteStatusLabel(quote.status)

  const model = toQuotePdfModel({
    quote: { ...quote, status: statusLabel },
    items,
    billFrom,
    billTo,
  })

  const buffer = await renderQuotePdf(model)

  if (!isPdfMagicBytes(buffer)) throw new InvalidPdfMagicBytesError()
  assertPdfSize(buffer)

  const key = buildQuoteKey()
  await uploadPdfToR2(key, buffer)

  try {
    await setQuotePdfKey(quoteId, key)
  } catch (err) {
    await deletePdfFromR2(key).catch((deleteErr) => {
      console.error("Failed to delete orphaned R2 object:", key, deleteErr)
    })
    throw err
  }

  return { pdfKey: key }
}
