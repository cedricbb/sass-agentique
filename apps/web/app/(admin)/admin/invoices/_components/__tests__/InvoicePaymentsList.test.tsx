// @vitest-environment jsdom
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { InvoicePaymentsList } from "../InvoicePaymentsList";

const mockDeletePaymentAction = vi.fn();
vi.mock("@/app/actions/payments", () => ({
  deletePaymentAction: (...args: unknown[]) => mockDeletePaymentAction(...args),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...args: Parameters<typeof mockToastSuccess>) => mockToastSuccess(...args),
    error: (...args: Parameters<typeof mockToastError>) => mockToastError(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const PAYMENT_1 = {
  id: "pay-1",
  invoiceId: "inv-1",
  amountEurCents: 5000,
  method: "bank_transfer" as const,
  externalRef: "REF-123",
  paidAt: new Date("2024-06-15"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenantId: "t1",
};

const PAYMENT_2 = {
  id: "pay-2",
  invoiceId: "inv-1",
  amountEurCents: 3000,
  method: "stripe_card" as const,
  externalRef: null,
  paidAt: new Date("2024-07-01"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenantId: "t1",
};

const PAYMENT_3 = {
  id: "pay-3",
  invoiceId: "inv-1",
  amountEurCents: 1000,
  method: "other" as const,
  externalRef: "LONGREF-ABCDEFGHIJ-KLMNOP",
  paidAt: new Date("2024-08-01"),
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenantId: "t1",
};

describe("InvoicePaymentsList", () => {
  it("T1 — shows empty state when no payments", () => {
    render(<InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[]} />);
    expect(screen.getByTestId("invoice-payments-empty")).toBeInTheDocument();
    expect(screen.getByText("Aucun paiement enregistré")).toBeInTheDocument();
  });

  it("T2 — renders N payment items", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1, PAYMENT_2, PAYMENT_3]} />,
    );
    expect(screen.getByTestId("invoice-payment-item-pay-1")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-payment-item-pay-2")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-payment-item-pay-3")).toBeInTheDocument();
  });

  it("T3 — displays date, FR method label, amount, and externalRef", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1, PAYMENT_2, PAYMENT_3]} />,
    );
    expect(screen.getByText("Virement")).toBeInTheDocument();
    expect(screen.getByText("Carte Stripe")).toBeInTheDocument();
    expect(screen.getByText("Autre")).toBeInTheDocument();
    expect(screen.getByText("REF-123")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("T4 — shows delete button when status is sent", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    expect(screen.getByTestId("invoice-payment-delete-trigger-pay-1")).toBeInTheDocument();
  });

  it("T5 — shows delete button when status is overdue", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="overdue" payments={[PAYMENT_1]} />,
    );
    expect(screen.getByTestId("invoice-payment-delete-trigger-pay-1")).toBeInTheDocument();
  });

  it("T6 — hides delete button when status is paid", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="paid" payments={[PAYMENT_1]} />,
    );
    expect(screen.queryByTestId("invoice-payment-delete-trigger-pay-1")).not.toBeInTheDocument();
  });

  it("T7 — opens AlertDialog on delete trigger click", async () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    fireEvent.click(screen.getByTestId("invoice-payment-delete-trigger-pay-1"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-payment-delete-confirm-pay-1")).toBeInTheDocument();
    });
  });

  it("T8 — confirm calls deletePaymentAction with correct args", async () => {
    mockDeletePaymentAction.mockResolvedValue({ ok: true, data: { deleted: true } });
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    fireEvent.click(screen.getByTestId("invoice-payment-delete-trigger-pay-1"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-payment-delete-confirm-pay-1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("invoice-payment-delete-confirm-pay-1"));
    });
    await waitFor(() => {
      expect(mockDeletePaymentAction).toHaveBeenCalledWith("pay-1", "inv-1");
    });
  });

  it("T9 — success shows toast.success", async () => {
    mockDeletePaymentAction.mockResolvedValue({ ok: true, data: { deleted: true } });
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    fireEvent.click(screen.getByTestId("invoice-payment-delete-trigger-pay-1"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-payment-delete-confirm-pay-1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("invoice-payment-delete-confirm-pay-1"));
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Paiement supprimé");
    });
  });

  it("T10 — PAYMENT_LOCKED error shows specific toast", async () => {
    mockDeletePaymentAction.mockResolvedValue({
      ok: false,
      error: { code: "PAYMENT_LOCKED_BY_INVOICE", message: "Locked", status: 409 },
    });
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    fireEvent.click(screen.getByTestId("invoice-payment-delete-trigger-pay-1"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-payment-delete-confirm-pay-1")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("invoice-payment-delete-confirm-pay-1"));
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Impossible de supprimer ce paiement : la facture est désormais payée.",
      );
    });
  });

  it("T11 — cancel closes dialog without calling delete", async () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={[PAYMENT_1]} />,
    );
    fireEvent.click(screen.getByTestId("invoice-payment-delete-trigger-pay-1"));
    await waitFor(() => {
      expect(screen.getByTestId("invoice-payment-delete-cancel")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("invoice-payment-delete-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("invoice-payment-delete-confirm-pay-1")).not.toBeInTheDocument();
    });
    expect(mockDeletePaymentAction).not.toHaveBeenCalled();
  });

  it("T12 — handles null/undefined payments as empty", () => {
    render(
      <InvoicePaymentsList invoiceId="inv-1" invoiceStatus="sent" payments={undefined} />,
    );
    expect(screen.getByTestId("invoice-payments-empty")).toBeInTheDocument();
  });
});
