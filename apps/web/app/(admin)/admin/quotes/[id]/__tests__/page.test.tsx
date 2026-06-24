// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

(globalThis as Record<string, unknown>).React = React;

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@saas/services", () => ({
  getQuoteById: vi.fn(),
  listClients: vi.fn().mockResolvedValue([]),
  listAllProjects: vi.fn().mockResolvedValue([]),
  listQuoteItems: vi.fn().mockResolvedValue([]),
  listPrestations: vi.fn().mockResolvedValue([]),
  listInvoices: vi.fn().mockResolvedValue([]),
  listClientContacts: vi.fn().mockResolvedValue([]),
}));

vi.mock("@saas/services/quote.shared", () => ({
  computeQuoteTtc: vi.fn().mockReturnValue({ totalHtCents: 10000, vatCents: 2000, totalTtcCents: 12000 }),
}));

vi.mock("../../_components/QuoteStatusActions", () => ({
  QuoteStatusActions: () => <div data-testid="mock-status-actions" />,
}));
vi.mock("../../_components/QuoteForm", () => ({
  QuoteForm: () => <div data-testid="mock-form" />,
}));
vi.mock("../../_components/QuoteItemsEditor", () => ({
  QuoteItemsEditor: () => <div data-testid="mock-items-editor" />,
}));
vi.mock("../../_components/QuoteAmountsCard", () => ({
  QuoteAmountsCard: () => <div data-testid="mock-amounts-card" />,
}));
vi.mock("../../_components/QuoteToInvoiceButton", () => ({
  QuoteToInvoiceButton: () => <div data-testid="mock-quote-to-invoice" />,
}));

import { getQuoteById } from "@saas/services";

afterEach(cleanup);

const MOCK_QUOTE_BASE = {
  id: "q-1",
  number: "DEV-2026-001",
  totalEurCents: 10000,
  vatRateBps: 2000,
  clientId: "c-1",
  projectId: null,
  status: "draft",
  issuedAt: null,
  expiresAt: null,
  acceptedAt: null,
  notes: null,
  pdfKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function renderPage(quote: Record<string, unknown>) {
  (getQuoteById as ReturnType<typeof vi.fn>).mockResolvedValue(quote);
  const EditQuotePage = (await import("../page")).default;
  const result = render(await EditQuotePage({ params: Promise.resolve({ id: "q-1" }) }));
  return result;
}

describe("EditQuotePage — Download button", () => {
  it("shows_download_button_when_issued", async () => {
    await renderPage({ ...MOCK_QUOTE_BASE, status: "sent", issuedAt: new Date() });
    const link = screen.getByRole("link", { name: /télécharger le pdf/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/quotes/q-1/file");
    expect(link).toHaveAttribute("download");
  });

  it("hides_download_button_when_draft", async () => {
    await renderPage({ ...MOCK_QUOTE_BASE, status: "draft", issuedAt: null });
    expect(screen.queryByRole("link", { name: /télécharger le pdf/i })).not.toBeInTheDocument();
  });
});
