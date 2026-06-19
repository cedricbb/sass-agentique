import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@saas/services", () => ({
  getInvoiceById: vi.fn(),
  listInvoiceItems: vi.fn(),
  getClientById: vi.fn(),
  getBusinessProfile: vi.fn(),
  setInvoicePdfKey: vi.fn(),
}))

vi.mock("@/lib/storage/r2", () => ({
  buildInvoiceKey: vi.fn(),
  uploadPdfToR2: vi.fn(),
  deletePdfFromR2: vi.fn(),
  isPdfMagicBytes: vi.fn(),
  assertPdfSize: vi.fn(),
  fetchImageBytesFromR2: vi.fn(),
  InvalidPdfMagicBytesError: class InvalidPdfMagicBytesError extends Error {
    constructor() {
      super("not valid PDF")
      this.name = "InvalidPdfMagicBytesError"
    }
  },
}))

vi.mock("../render", () => ({
  renderInvoicePdf: vi.fn(),
}))

import { generateAndStoreInvoicePdf, BusinessProfileRequiredError } from "../generate-invoice-pdf"
import {
  getInvoiceById,
  listInvoiceItems,
  getClientById,
  getBusinessProfile,
  setInvoicePdfKey,
} from "@saas/services"
import {
  buildInvoiceKey,
  uploadPdfToR2,
  deletePdfFromR2,
  isPdfMagicBytes,
  assertPdfSize,
  fetchImageBytesFromR2,
} from "@/lib/storage/r2"
import { renderInvoicePdf } from "../render"

const INVOICE_ID = "00000000-0000-0000-0000-000000000001"
const CLIENT_ID = "00000000-0000-0000-0000-000000000002"
const OWNER_ID = "00000000-0000-0000-0000-000000000003"
const PDF_KEY = "invoices/2026/06/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf"
const FAKE_PDF_BUFFER = Buffer.from("%PDF-fake")

const fixtureInvoice = {
  id: INVOICE_ID,
  ownerId: OWNER_ID,
  clientId: CLIENT_ID,
  number: "INV-2026-001",
  status: "sent",
  pdfKey: null,
  issuedAt: new Date("2026-01-01"),
  dueAt: new Date("2026-02-01"),
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  quoteId: null,
  projectId: null,
  paidAt: null,
}

const fixtureItems = [
  {
    id: "item-1",
    invoiceId: INVOICE_ID,
    description: "Service A",
    quantity: 2,
    unitPriceEurCents: 5000,
    sortOrder: 0,
  },
]

const fixtureClient = {
  id: CLIENT_ID,
  name: "ACME Corp",
  type: "company" as const,
  email: "acme@example.com",
  phone: null,
  billingAddress: { line1: "1 rue de la Paix", city: "Paris", zip: "75001", country: "FR" },
  slug: "acme-corp",
  ownerId: OWNER_ID,
  siret: null,
  tvaIntra: null,
  archivedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

const fixtureProfile = {
  id: "profile-1",
  ownerId: OWNER_ID,
  name: "Mon Entreprise SAS",
  legalForm: "SAS",
  siret: "12345678901234",
  tvaIntra: "FR12345678901",
  address: { line1: "10 avenue de l'Opéra", city: "Paris", zip: "75001", country: "FR" },
  email: "contact@mon-entreprise.fr",
  phone: "+33123456789",
  iban: null,
  bic: null,
  logoKey: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
}

function setupHappyPath() {
  vi.mocked(getInvoiceById).mockResolvedValue(fixtureInvoice as never)
  vi.mocked(listInvoiceItems).mockResolvedValue(fixtureItems as never)
  vi.mocked(getClientById).mockResolvedValue(fixtureClient as never)
  vi.mocked(getBusinessProfile).mockResolvedValue(fixtureProfile as never)
  vi.mocked(renderInvoicePdf).mockResolvedValue(FAKE_PDF_BUFFER)
  vi.mocked(isPdfMagicBytes).mockReturnValue(true)
  vi.mocked(assertPdfSize).mockReturnValue(undefined)
  vi.mocked(buildInvoiceKey).mockReturnValue(PDF_KEY)
  vi.mocked(uploadPdfToR2).mockResolvedValue(undefined)
  vi.mocked(setInvoicePdfKey).mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generateAndStoreInvoicePdf", () => {
  it("returns_pdfKey_and_persists_on_valid_invoice", async () => {
    setupHappyPath()

    const result = await generateAndStoreInvoicePdf(INVOICE_ID)

    expect(result).toEqual({ pdfKey: PDF_KEY })
    expect(vi.mocked(setInvoicePdfKey)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setInvoicePdfKey)).toHaveBeenCalledWith(INVOICE_ID, PDF_KEY)
    expect(result.pdfKey).toMatch(/^invoices\/\d{4}\/\d{2}\/[a-f0-9-]+\.pdf$/)
  })

  it("skips_render_and_upload_when_pdfKey_already_set", async () => {
    vi.mocked(getInvoiceById).mockResolvedValue({
      ...fixtureInvoice,
      pdfKey: "invoices/2026/01/existing-key.pdf",
    } as never)

    const result = await generateAndStoreInvoicePdf(INVOICE_ID)

    expect(result).toEqual({ pdfKey: "invoices/2026/01/existing-key.pdf" })
    expect(vi.mocked(renderInvoicePdf)).not.toHaveBeenCalled()
    expect(vi.mocked(uploadPdfToR2)).not.toHaveBeenCalled()
  })

  it("throws_BusinessProfileRequiredError_when_profile_null", async () => {
    vi.mocked(getInvoiceById).mockResolvedValue(fixtureInvoice as never)
    vi.mocked(listInvoiceItems).mockResolvedValue(fixtureItems as never)
    vi.mocked(getClientById).mockResolvedValue(fixtureClient as never)
    vi.mocked(getBusinessProfile).mockResolvedValue(null)

    await expect(generateAndStoreInvoicePdf(INVOICE_ID)).rejects.toThrow(BusinessProfileRequiredError)
    expect(vi.mocked(uploadPdfToR2)).not.toHaveBeenCalled()
  })

  it("calls_deletePdfFromR2_on_setInvoicePdfKey_failure", async () => {
    setupHappyPath()
    vi.mocked(setInvoicePdfKey).mockRejectedValue(new Error("DB error"))
    vi.mocked(deletePdfFromR2).mockResolvedValue(undefined)

    await expect(generateAndStoreInvoicePdf(INVOICE_ID)).rejects.toThrow("DB error")
    expect(vi.mocked(deletePdfFromR2)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deletePdfFromR2)).toHaveBeenCalledWith(PDF_KEY)
  })

  it("setInvoicePdfKey_called_with_invoiceId_and_key", async () => {
    setupHappyPath()

    await generateAndStoreInvoicePdf(INVOICE_ID)

    expect(vi.mocked(setInvoicePdfKey)).toHaveBeenCalledWith(INVOICE_ID, PDF_KEY)
  })

  it("validates_pdf_magic_bytes_and_size_before_upload", async () => {
    setupHappyPath()
    const callOrder: string[] = []
    vi.mocked(isPdfMagicBytes).mockImplementation(() => { callOrder.push("isPdfMagicBytes"); return true })
    vi.mocked(assertPdfSize).mockImplementation(() => { callOrder.push("assertPdfSize") })
    vi.mocked(uploadPdfToR2).mockImplementation(async () => { callOrder.push("uploadPdfToR2") })

    await generateAndStoreInvoicePdf(INVOICE_ID)

    expect(callOrder.indexOf("isPdfMagicBytes")).toBeLessThan(callOrder.indexOf("uploadPdfToR2"))
    expect(callOrder.indexOf("assertPdfSize")).toBeLessThan(callOrder.indexOf("uploadPdfToR2"))
  })

  it("logo_data_uri_passed_to_renderer_when_profile_has_logo_key", async () => {
    setupHappyPath()
    vi.mocked(getBusinessProfile).mockResolvedValue({ ...fixtureProfile, logoKey: "logos/test.png" } as never)
    vi.mocked(fetchImageBytesFromR2).mockResolvedValue({ buffer: Buffer.from("PNG"), contentType: "image/png" } as never)
    let capturedBillFrom: unknown = null
    vi.mocked(renderInvoicePdf).mockImplementation(async (model) => {
      capturedBillFrom = model.billFrom
      return FAKE_PDF_BUFFER
    })

    await generateAndStoreInvoicePdf(INVOICE_ID)

    expect((capturedBillFrom as Record<string, unknown>).logoUrl).toMatch(/^data:image\/png;base64,/)
  })

  it("logo_url_undefined_when_profile_has_no_logo_key", async () => {
    setupHappyPath()
    let capturedEmitter: unknown = null
    vi.mocked(renderInvoicePdf).mockImplementation(async (model) => {
      capturedEmitter = model.billFrom
      return FAKE_PDF_BUFFER
    })

    await generateAndStoreInvoicePdf(INVOICE_ID)

    expect(capturedEmitter).toBeDefined()
    expect((capturedEmitter as Record<string, unknown>).logoUrl).toBeUndefined()
    expect((capturedEmitter as Record<string, unknown>).name).toBe("Mon Entreprise SAS")
  })

  it("logo_fetch_failure_does_not_break_invoice_generation", async () => {
    setupHappyPath()
    vi.mocked(getBusinessProfile).mockResolvedValue({ ...fixtureProfile, logoKey: "logos/broken.png" } as never)
    vi.mocked(fetchImageBytesFromR2).mockRejectedValue(new Error("R2 fetch failed"))
    let capturedBillFrom: unknown = null
    vi.mocked(renderInvoicePdf).mockImplementation(async (model) => {
      capturedBillFrom = model.billFrom
      return FAKE_PDF_BUFFER
    })

    await expect(generateAndStoreInvoicePdf(INVOICE_ID)).resolves.toEqual({ pdfKey: PDF_KEY })
    expect((capturedBillFrom as Record<string, unknown>).logoUrl).toBeUndefined()
  })
})
