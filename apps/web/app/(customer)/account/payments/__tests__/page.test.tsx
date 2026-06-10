import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockRequireCustomer = vi.hoisted(() => vi.fn())
const mockListPayments = vi.hoisted(() => vi.fn())
const mockFormatCurrency = vi.hoisted(() => vi.fn((n: number) => `${n.toFixed(2)} €`))
const mockFormatDate = vi.hoisted(() => vi.fn(() => "01/01/2026"))

vi.mock("@/lib/auth", () => ({ requireCustomer: mockRequireCustomer }))
vi.mock("@saas/services", () => ({
  paymentService: {
    listPaymentsForCustomerPortal: (...args: unknown[]) => mockListPayments(...args),
  },
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
  default: ({ children, href, ...rest }: Record<string, unknown>) =>
    React.createElement("a", { href, ...rest }, children as React.ReactNode),
}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/account/payments",
}))
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
  CreditCard: () => null,
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

const mockPayment1 = {
  id: "pay-uuid-1",
  invoiceId: "inv-uuid-1",
  amountCents: 5000,
  method: "stripe_card" as const,
  paidAt: new Date("2026-01-15"),
  invoiceNumber: "F-2026-001",
}

const mockPayment2 = {
  id: "pay-uuid-2",
  invoiceId: "inv-uuid-2",
  amountCents: 15000,
  method: "bank_transfer" as const,
  paidAt: new Date("2026-02-10"),
  invoiceNumber: "F-2026-002",
}

const mockPaymentOther = {
  id: "pay-uuid-3",
  invoiceId: "inv-uuid-3",
  amountCents: 3000,
  method: "other" as const,
  paidAt: new Date("2026-03-05"),
  invoiceNumber: "F-2026-003",
}

describe("CustomerPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireCustomer.mockResolvedValue({ client: mockClient })
  })

  it("renders_payments_table_with_rows", async () => {
    mockListPayments.mockResolvedValue([mockPayment1, mockPayment2])
    const { default: CustomerPaymentsPage } = await import("../page")
    const element = await CustomerPaymentsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="payments-table"')
    expect(html).toContain('data-testid="payment-row"')
    const rowCount = (html.match(/data-testid="payment-row"/g) ?? []).length
    expect(rowCount).toBe(2)
  })

  it("renders_empty_state_when_no_payments", async () => {
    mockListPayments.mockResolvedValue([])
    const { default: CustomerPaymentsPage } = await import("../page")
    const element = await CustomerPaymentsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('data-testid="payments-empty"')
    expect(html).toContain("Aucun paiement enregistré")
    expect(html).not.toContain('data-testid="payments-table"')
  })

  it("renders_payment_method_badge_labels", async () => {
    mockListPayments.mockResolvedValue([mockPayment1, mockPayment2, mockPaymentOther])
    const { default: CustomerPaymentsPage } = await import("../page")
    const element = await CustomerPaymentsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("Carte bancaire")
    expect(html).toContain("Virement bancaire")
    expect(html).toContain("Autre")
    expect(html).toContain('data-testid="payment-method-badge"')
  })

  it("renders_invoice_link_with_correct_href", async () => {
    mockListPayments.mockResolvedValue([mockPayment1])
    const { default: CustomerPaymentsPage } = await import("../page")
    const element = await CustomerPaymentsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain('href="/account/invoices/inv-uuid-1"')
    expect(html).toContain("F-2026-001")
    expect(html).toContain('data-testid="payment-invoice-link"')
  })

  it("renders_amount_with_ttc_suffix", async () => {
    mockFormatCurrency.mockReturnValue("50,00 €")
    mockListPayments.mockResolvedValue([mockPayment1])
    const { default: CustomerPaymentsPage } = await import("../page")
    const element = await CustomerPaymentsPage()
    const html = renderToStaticMarkup(element)

    expect(html).toContain("TTC")
  })
})

describe("CustomerSidebar payments nav", () => {
  it("nav_items_contains_payments_at_index_3", async () => {
    const { NAV_ITEMS } = await import("@/components/layout/CustomerSidebar")

    expect(NAV_ITEMS.length).toBe(7)
    expect(NAV_ITEMS[3].href).toBe("/account/payments")
    expect(NAV_ITEMS[3].label).toBe("Mes paiements")
  })
})

describe("CustomerShell payments title", () => {
  it("page_titles_contains_payments_entry", async () => {
    const { PAGE_TITLES } = await import("@/components/layout/CustomerShell")

    expect(PAGE_TITLES["payments"]).toBe("Mes paiements")
  })
})
