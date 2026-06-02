import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRequireCustomer = vi.hoisted(() => vi.fn())
const mockListContracts = vi.hoisted(() => vi.fn())
const mockListPrestations = vi.hoisted(() => vi.fn())
const mockFormatCurrency = vi.hoisted(() => vi.fn((n: number) => `${n.toFixed(2)} €`))
const mockFormatDate = vi.hoisted(() => vi.fn(() => "01/01/2024"))

vi.mock("@/lib/auth", () => ({ requireCustomer: mockRequireCustomer }))
vi.mock("@saas/services", () => ({
  maintenanceContractService: { listContractsForCustomerPortal: mockListContracts },
  listPrestations: mockListPrestations,
}))
vi.mock("@/lib/format", () => ({ formatCurrency: mockFormatCurrency, formatDate: mockFormatDate }))
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ variant, children, ...props }: Record<string, unknown>) =>
    React.createElement("span", { "data-variant": variant, ...props }, children as React.ReactNode),
}))
vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  CardContent: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement("div", props, children as React.ReactNode),
}))
vi.mock("next/link", () => ({
  default: ({ children, href }: Record<string, unknown>) =>
    React.createElement("a", { href }, children as React.ReactNode),
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/account/contracts" }))
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}))
vi.mock("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}))
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
  SheetContent: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
}))
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
}))
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
  TooltipContent: ({ children }: Record<string, unknown>) =>
    React.createElement("span", null, children as React.ReactNode),
  TooltipProvider: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
  TooltipTrigger: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: Record<string, unknown>) =>
    React.createElement("button", { onClick: onClick as React.MouseEventHandler }, children as React.ReactNode),
}))
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  AvatarFallback: ({ children }: Record<string, unknown>) =>
    React.createElement("span", null, children as React.ReactNode),
}))
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
  DropdownMenuContent: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  DropdownMenuItem: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  DropdownMenuLabel: ({ children }: Record<string, unknown>) =>
    React.createElement("div", null, children as React.ReactNode),
  DropdownMenuSeparator: () => null,
  DropdownMenuTrigger: ({ children }: Record<string, unknown>) =>
    React.createElement(React.Fragment, null, children as React.ReactNode),
}))
vi.mock("lucide-react", () => ({
  Home: () => null,
  FileText: () => null,
  Receipt: () => null,
  FileBarChart: () => null,
  FileSignature: () => null,
  User: () => null,
  Menu: () => null,
  PanelLeftClose: () => null,
  PanelLeftOpen: () => null,
  Sun: () => null,
  Moon: () => null,
}))
vi.mock("@/components/auth/EmailVerificationBanner", () => ({
  EmailVerificationBanner: () => null,
}))
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => null,
}))

const mockClient = { id: "client-uuid-1" }
const mockPrestation = { id: "prestation-uuid-1", name: "Maintenance Pro" }
const mockContract = {
  id: "contract-uuid-1",
  clientId: "client-uuid-1",
  prestationId: "prestation-uuid-1",
  billingMode: "stripe_auto",
  status: "active",
  monthlyPriceEurCents: 9900,
  startedAt: new Date("2024-01-15"),
}
const mockContractPastDue = {
  ...mockContract,
  id: "contract-uuid-2",
  billingMode: "manual_invoice",
  status: "past_due",
  monthlyPriceEurCents: 14900,
}

describe("CustomerContractsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireCustomer.mockResolvedValue({ client: mockClient })
    mockListPrestations.mockResolvedValue([mockPrestation])
  })

  it("renders_contracts_table_with_columns", async () => {
    mockListContracts.mockResolvedValue([mockContract])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="contracts-table"')
    expect(html).toContain("<th")
    expect(html).toContain("Prestation")
    expect(html).toContain("Statut")
    expect(html).toContain("Mode facturation")
    expect(html).toContain("Prix mensuel")
    expect(html).toContain("Depuis le")
    expect(html).toContain('data-testid="contract-row"')
  })

  it("renders_empty_state_when_no_contracts", async () => {
    mockListContracts.mockResolvedValue([])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="contracts-empty"')
    expect(html).toContain("Aucun contrat actif")
    expect(html).not.toContain('data-testid="contracts-table"')
  })

  it("renders_status_badge_active_success", async () => {
    mockListContracts.mockResolvedValue([mockContract])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-variant="success"')
    expect(html).toContain("Actif")
  })

  it("renders_status_badge_past_due_destructive", async () => {
    mockListContracts.mockResolvedValue([mockContractPastDue])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-variant="destructive"')
    expect(html).toContain("Paiement en attente")
  })

  it("renders_billing_mode_labels", async () => {
    mockListContracts.mockResolvedValue([mockContract, mockContractPastDue])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Stripe (auto)")
    expect(html).toContain("Facturation manuelle")
  })

  it("renders_monthly_price_formatted_ht", async () => {
    mockFormatCurrency.mockReturnValue("99,00 €")
    mockListContracts.mockResolvedValue([mockContract])
    const { default: CustomerContractsPage } = await import("../page")
    const element = await CustomerContractsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("99,00 €")
    expect(html).toContain("/ mois HT")
  })
})

describe("CustomerSidebar", () => {
  it("sidebar_contains_contracts_nav_item", async () => {
    const { NAV_ITEMS } = await import("@/components/layout/CustomerSidebar")
    const contractsItem = NAV_ITEMS.find((item) => item.href === "/account/contracts")

    expect(contractsItem).toBeDefined()
    expect(contractsItem?.label).toBe("Mes contrats")
    expect(NAV_ITEMS.indexOf(contractsItem!)).toBe(4)
  })
})

describe("CustomerShell", () => {
  it("shell_contains_contracts_page_title", async () => {
    const { PAGE_TITLES } = await import("@/components/layout/CustomerShell")

    expect(PAGE_TITLES["contracts"]).toBe("Mes contrats")
  })
})
