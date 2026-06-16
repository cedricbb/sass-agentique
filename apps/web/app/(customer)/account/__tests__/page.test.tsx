import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRequireCustomer = vi.hoisted(() => vi.fn())
const mockCountPendingQuotes = vi.hoisted(() => vi.fn())
const mockCountUnpaidInvoices = vi.hoisted(() => vi.fn())
const mockCountIssuedReports = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ requireCustomer: mockRequireCustomer }))
vi.mock("@saas/services/quote.service", () => ({
  countPendingQuotesForClient: (...args: unknown[]) => mockCountPendingQuotes(...args),
}))
vi.mock("@saas/services/invoice.service", () => ({
  countUnpaidInvoicesForClient: (...args: unknown[]) => mockCountUnpaidInvoices(...args),
}))
vi.mock("@saas/services/report.service", () => ({
  countIssuedReportsForClient: (...args: unknown[]) => mockCountIssuedReports(...args),
}))
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}))
vi.mock("lucide-react", () => ({
  FileText: () => null,
  Receipt: () => null,
  FileBarChart: () => null,
}))
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: Record<string, unknown>) =>
    React.createElement("div", { className: className as string }, children as React.ReactNode),
  CardHeader: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  CardTitle: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  CardDescription: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
}))

const mockClient = { id: "client-uuid-1" }

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireCustomer.mockResolvedValue({ client: mockClient })
  })

  it("renders_dashboard_stats_with_counts", async () => {
    mockCountPendingQuotes.mockResolvedValue(3)
    mockCountUnpaidInvoices.mockResolvedValue(2)
    mockCountIssuedReports.mockResolvedValue(5)

    const { default: AccountPage } = await import("../page")
    const element = await AccountPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("3 devis en attente d&#x27;acceptation")
    expect(html).toContain("2 factures")
    expect(html).toContain("5 rapports disponibles")
  })

  it("renders_dashboard_empty_state_texts", async () => {
    mockCountPendingQuotes.mockResolvedValue(0)
    mockCountUnpaidInvoices.mockResolvedValue(0)
    mockCountIssuedReports.mockResolvedValue(0)

    const { default: AccountPage } = await import("../page")
    const element = await AccountPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Aucun devis en attente")
    expect(html).toContain("Aucune facture")
    expect(html).toContain("Aucun rapport disponible")
    expect(html).not.toContain(">0 devis")
    expect(html).not.toContain(">0 facture")
    expect(html).not.toContain(">0 rapport")
  })

  it("dashboard_cards_link_to_list_pages", async () => {
    mockCountPendingQuotes.mockResolvedValue(1)
    mockCountUnpaidInvoices.mockResolvedValue(1)
    mockCountIssuedReports.mockResolvedValue(1)

    const { default: AccountPage } = await import("../page")
    const element = await AccountPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('href="/account/quotes"')
    expect(html).toContain('href="/account/invoices"')
    expect(html).toContain('href="/account/reports"')
  })
})
