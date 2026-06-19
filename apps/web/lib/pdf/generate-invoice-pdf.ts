import "server-only"
import type { BusinessProfile } from "@saas/db"
import {
  getInvoiceById,
  listInvoiceItems,
  getClientById,
  getBusinessProfile,
  setInvoicePdfKey,
} from "@saas/services"
import {
  resolveBillingParty,
  resolveEmitter,
  parseAddressJsonb,
  type EmitterInput,
} from "@saas/services/billing-party.shared"
import { toInvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import {
  buildInvoiceKey,
  uploadPdfToR2,
  deletePdfFromR2,
  isPdfMagicBytes,
  assertPdfSize,
  fetchImageBytesFromR2,
  InvalidPdfMagicBytesError,
} from "@/lib/storage/r2"
import { renderInvoicePdf } from "./render"

export class InvoiceNotFoundError extends Error {
  constructor(invoiceId: string) {
    super(`Invoice not found: ${invoiceId}`)
    this.name = "InvoiceNotFoundError"
  }
}

export class BusinessProfileRequiredError extends Error {
  constructor(ownerId: string) {
    super(`Business profile required for owner: ${ownerId}`)
    this.name = "BusinessProfileRequiredError"
  }
}

export class ClientNotFoundError extends Error {
  constructor(clientId: string) {
    super(`Client not found: ${clientId}`)
    this.name = "ClientNotFoundError"
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
}

function resolveInvoiceStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export async function resolveEmitterLogoDataUri(profile: BusinessProfile): Promise<string | undefined> {
  if (profile.logoKey == null) return undefined
  try {
    const { buffer, contentType } = await fetchImageBytesFromR2(profile.logoKey)
    return `data:${contentType};base64,${buffer.toString("base64")}`
  } catch (err) {
    console.error("[resolveEmitterLogoDataUri] logo fetch failed (best-effort)", profile.logoKey, err)
    return undefined
  }
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

export async function generateAndStoreInvoicePdf(invoiceId: string): Promise<{ pdfKey: string }> {
  const invoice = await getInvoiceById(invoiceId)
  if (!invoice) throw new InvoiceNotFoundError(invoiceId)

  if (invoice.pdfKey != null) return { pdfKey: invoice.pdfKey }

  const [items, client, profile] = await Promise.all([
    listInvoiceItems(invoiceId),
    getClientById(invoice.clientId),
    getBusinessProfile(invoice.ownerId),
  ])

  if (!client) throw new ClientNotFoundError(invoice.clientId)
  if (!profile) throw new BusinessProfileRequiredError(invoice.ownerId)

  const billTo = resolveBillingParty(client)
  const logoUrl = await resolveEmitterLogoDataUri(profile)
  const billFrom = resolveEmitter({ ...toEmitterInput(profile), logoUrl })
  const statusLabel = resolveInvoiceStatusLabel(invoice.status)

  const model = toInvoicePdfModel({
    invoice: { ...invoice, status: statusLabel },
    items,
    billFrom,
    billTo,
  })

  const buffer = await renderInvoicePdf(model)

  if (!isPdfMagicBytes(buffer)) throw new InvalidPdfMagicBytesError()
  assertPdfSize(buffer)

  const key = buildInvoiceKey()
  await uploadPdfToR2(key, buffer)

  try {
    await setInvoicePdfKey(invoiceId, key)
  } catch (err) {
    await deletePdfFromR2(key).catch((deleteErr) => {
      console.error("Failed to delete orphaned R2 object:", key, deleteErr)
    })
    throw err
  }

  return { pdfKey: key }
}
