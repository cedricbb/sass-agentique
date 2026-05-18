// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteToInvoiceButton } from "../QuoteToInvoiceButton";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateInvoiceFromQuoteAction = vi.fn();
vi.mock("@/app/actions/invoices", () => ({
  createInvoiceFromQuoteAction: (...args: unknown[]) => mockCreateInvoiceFromQuoteAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("QuoteToInvoiceButton", () => {
  it("T1 — renders button when not already invoiced", () => {
    render(<QuoteToInvoiceButton quoteId="q-1" alreadyInvoiced={false} />);
    expect(screen.getByTestId("quote-to-invoice-button")).toBeInTheDocument();
    expect(screen.getByTestId("quote-to-invoice-button")).toBeEnabled();
  });

  it("T2 — renders disabled button + hint when already invoiced", () => {
    render(<QuoteToInvoiceButton quoteId="q-1" alreadyInvoiced={true} />);
    expect(screen.getByTestId("quote-to-invoice-already-invoiced-hint")).toHaveTextContent(
      "Une facture existe déjà pour ce devis.",
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("T3 — opens AlertDialog on click", async () => {
    render(<QuoteToInvoiceButton quoteId="q-1" alreadyInvoiced={false} />);
    fireEvent.click(screen.getByTestId("quote-to-invoice-button"));
    await waitFor(() => {
      expect(screen.getByText("Confirmer la création de facture depuis ce devis ?")).toBeInTheDocument();
    });
  });

  it("T4 — confirm calls createInvoiceFromQuoteAction and redirects on success", async () => {
    mockCreateInvoiceFromQuoteAction.mockResolvedValue({
      ok: true,
      data: { id: "inv-42" },
    });
    render(<QuoteToInvoiceButton quoteId="q-1" alreadyInvoiced={false} />);
    fireEvent.click(screen.getByTestId("quote-to-invoice-button"));
    await waitFor(() => {
      expect(screen.getByTestId("quote-to-invoice-confirm")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("quote-to-invoice-confirm"));
    await waitFor(() => {
      expect(mockCreateInvoiceFromQuoteAction).toHaveBeenCalledWith({ quoteId: "q-1" });
      expect(mockPush).toHaveBeenCalledWith("/admin/invoices/inv-42");
    });
  });

  it("T5 — error result shows toast, no redirect", async () => {
    mockCreateInvoiceFromQuoteAction.mockResolvedValue({
      ok: false,
      error: { message: "Erreur serveur" },
    });
    render(<QuoteToInvoiceButton quoteId="q-1" alreadyInvoiced={false} />);
    fireEvent.click(screen.getByTestId("quote-to-invoice-button"));
    await waitFor(() => {
      expect(screen.getByTestId("quote-to-invoice-confirm")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("quote-to-invoice-confirm"));
    await waitFor(() => {
      expect(mockCreateInvoiceFromQuoteAction).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("T6 — passes correct quoteId to action", async () => {
    mockCreateInvoiceFromQuoteAction.mockResolvedValue({
      ok: true,
      data: { id: "inv-99" },
    });
    render(<QuoteToInvoiceButton quoteId="q-special" alreadyInvoiced={false} />);
    fireEvent.click(screen.getByTestId("quote-to-invoice-button"));
    await waitFor(() => {
      expect(screen.getByTestId("quote-to-invoice-confirm")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("quote-to-invoice-confirm"));
    await waitFor(() => {
      expect(mockCreateInvoiceFromQuoteAction).toHaveBeenCalledWith({ quoteId: "q-special" });
    });
  });
});
