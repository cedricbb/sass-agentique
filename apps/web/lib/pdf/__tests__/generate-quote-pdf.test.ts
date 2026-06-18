import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

vi.mock("@saas/services", () => ({
  getQuoteById: vi.fn(),
  listQuoteItems: vi.fn(),
  getClientById: vi.fn(),
  getBusinessProfile: vi.fn(),
  setQuotePdfKey: vi.fn(),
}))

vi.mock("@/lib/storage/r2", () => ({
  buildQuoteKey: vi.fn(),
  uploadPdfToR2: vi.fn(),
  deletePdfFromR2: vi.fn(),
  isPdfMagicBytes: vi.fn(),
  assertPdfSize: vi.fn(),
  InvalidPdfMagicBytesError: class InvalidPdfMagicBytesError extends Error {
    constructor() {
      super("not valid PDF")
      this.name = "InvalidPdfMagicBytesError"
    }
  },
}))

vi.mock("../render", () => ({
  renderQuotePdf: vi.fn(),
}))

vi.mock("../generate-invoice-pdf", () => ({
  BusinessProfileRequiredError: class BusinessProfileRequiredError extends Error {
    constructor(ownerId: string) {
      super(`Business profile required for owner: ${ownerId}`)
      this.name = "BusinessProfileRequiredError"
    }
  },
  ClientNotFoundError: class ClientNotFoundError extends Error {
    constructor(clientId: string) {
      super(`Client not found: ${clientId}`)
      this.name = "ClientNotFoundError"
    }
  },
}))

import { generateAndStoreQuotePdf, BusinessProfileRequiredError } from "../generate-quote-pdf"
import {
  getQuoteById,
  listQuoteItems,
  getClientById,
  getBusinessProfile,
  setQuotePdfKey,
} from "@saas/services"
import {
  buildQuoteKey,
  uploadPdfToR2,
  deletePdfFromR2,
  isPdfMagicBytes,
  assertPdfSize,
} from "@/lib/storage/r2"
import { renderQuotePdf } from "../render"

const QUOTE_ID = "00000000-0000-0000-0000-000000000001"
const CLIENT_ID = "00000000-0000-0000-0000-000000000002"
const OWNER_ID = "00000000-0000-0000-0000-000000000003"
const PDF_KEY = "quotes/2026/06/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.pdf"
const FAKE_PDF_BUFFER = Buffer.from("%PDF-fake")

const fixtureQuote = {
  id: QUOTE_ID,
  ownerId: OWNER_ID,
  clientId: CLIENT_ID,
  number: "QUO-2026-001",
  status: "sent",
  pdfKey: null,
  issuedAt: new Date("2026-01-01"),
  expiresAt: new Date("2026-02-01"),
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  projectId: null,
}

const fixtureItems = [
  {
    id: "item-1",
    quoteId: QUOTE_ID,
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
  vi.mocked(getQuoteById).mockResolvedValue(fixtureQuote as never)
  vi.mocked(listQuoteItems).mockResolvedValue(fixtureItems as never)
  vi.mocked(getClientById).mockResolvedValue(fixtureClient as never)
  vi.mocked(getBusinessProfile).mockResolvedValue(fixtureProfile as never)
  vi.mocked(renderQuotePdf).mockResolvedValue(FAKE_PDF_BUFFER)
  vi.mocked(isPdfMagicBytes).mockReturnValue(true)
  vi.mocked(assertPdfSize).mockReturnValue(undefined)
  vi.mocked(buildQuoteKey).mockReturnValue(PDF_KEY)
  vi.mocked(uploadPdfToR2).mockResolvedValue(undefined)
  vi.mocked(setQuotePdfKey).mockResolvedValue(undefined)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("generateAndStoreQuotePdf", () => {
  it("returns_pdfKey_and_persists_on_valid_quote", async () => {
    setupHappyPath()

    const result = await generateAndStoreQuotePdf(QUOTE_ID)

    expect(result).toEqual({ pdfKey: PDF_KEY })
    expect(vi.mocked(setQuotePdfKey)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(setQuotePdfKey)).toHaveBeenCalledWith(QUOTE_ID, PDF_KEY)
    expect(vi.mocked(uploadPdfToR2)).toHaveBeenCalledTimes(1)
    expect(result.pdfKey).toMatch(/^quotes\/\d{4}\/\d{2}\/[a-f0-9-]+\.pdf$/)
  })

  it("skips_render_and_upload_when_pdfKey_already_set", async () => {
    vi.mocked(getQuoteById).mockResolvedValue({
      ...fixtureQuote,
      pdfKey: "quotes/2026/01/existing-key.pdf",
    } as never)

    const result = await generateAndStoreQuotePdf(QUOTE_ID)

    expect(result).toEqual({ pdfKey: "quotes/2026/01/existing-key.pdf" })
    expect(vi.mocked(renderQuotePdf)).not.toHaveBeenCalled()
    expect(vi.mocked(uploadPdfToR2)).not.toHaveBeenCalled()
  })

  it("throws_BusinessProfileRequiredError_when_profile_null", async () => {
    vi.mocked(getQuoteById).mockResolvedValue(fixtureQuote as never)
    vi.mocked(listQuoteItems).mockResolvedValue(fixtureItems as never)
    vi.mocked(getClientById).mockResolvedValue(fixtureClient as never)
    vi.mocked(getBusinessProfile).mockResolvedValue(null)

    await expect(generateAndStoreQuotePdf(QUOTE_ID)).rejects.toThrow(BusinessProfileRequiredError)
    expect(vi.mocked(uploadPdfToR2)).not.toHaveBeenCalled()
  })

  it("calls_deletePdfFromR2_on_setQuotePdfKey_failure", async () => {
    setupHappyPath()
    vi.mocked(setQuotePdfKey).mockRejectedValue(new Error("DB error"))
    vi.mocked(deletePdfFromR2).mockResolvedValue(undefined)

    await expect(generateAndStoreQuotePdf(QUOTE_ID)).rejects.toThrow("DB error")
    expect(vi.mocked(deletePdfFromR2)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deletePdfFromR2)).toHaveBeenCalledWith(PDF_KEY)
  })

  it("validates_pdf_magic_bytes_and_size_before_upload", async () => {
    setupHappyPath()
    const callOrder: string[] = []
    vi.mocked(isPdfMagicBytes).mockImplementation(() => { callOrder.push("isPdfMagicBytes"); return true })
    vi.mocked(assertPdfSize).mockImplementation(() => { callOrder.push("assertPdfSize") })
    vi.mocked(uploadPdfToR2).mockImplementation(async () => { callOrder.push("uploadPdfToR2") })

    await generateAndStoreQuotePdf(QUOTE_ID)

    expect(callOrder.indexOf("isPdfMagicBytes")).toBeLessThan(callOrder.indexOf("uploadPdfToR2"))
    expect(callOrder.indexOf("assertPdfSize")).toBeLessThan(callOrder.indexOf("uploadPdfToR2"))
  })

  it("toEmitterInput_maps_profile_without_logoUrl", async () => {
    setupHappyPath()
    let capturedEmitter: unknown = null
    vi.mocked(renderQuotePdf).mockImplementation(async (model) => {
      capturedEmitter = model.billFrom
      return FAKE_PDF_BUFFER
    })

    await generateAndStoreQuotePdf(QUOTE_ID)

    expect(capturedEmitter).toBeDefined()
    expect((capturedEmitter as Record<string, unknown>).logoUrl).toBeUndefined()
    expect((capturedEmitter as Record<string, unknown>).name).toBe("Mon Entreprise SAS")
  })
})
