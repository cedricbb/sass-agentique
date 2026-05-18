// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecordPaymentDialog } from "../RecordPaymentDialog";

const mockCreatePaymentAction = vi.fn();
vi.mock("@/app/actions/payments", () => ({
  createPaymentAction: (...args: unknown[]) => mockCreatePaymentAction(...args),
}));

const mockToastResult = vi.fn((result: { ok: boolean }, _msg: string) => result.ok);
const mockToastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toastResult: (...args: Parameters<typeof mockToastResult>) => mockToastResult(...args),
  toast: { error: (...args: Parameters<typeof mockToastError>) => mockToastError(...args) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

const DEFAULT_PROPS = {
  invoiceId: "inv-uuid-1",
  invoiceNumber: "INV-2024-001",
  remainingTtcCents: 15000,
};

function openDialog() {
  fireEvent.click(screen.getByTestId("record-payment-button"));
}

describe("RecordPaymentDialog", () => {
  it("T1 — renders trigger button and dialog opens with all fields", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    expect(screen.getByTestId("record-payment-button")).toBeInTheDocument();
    openDialog();
    await waitFor(() => {
      expect(screen.getByTestId("record-payment-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-amount-input")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-method-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-paidat-input")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-externalref-input")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-notes-input")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-submit")).toBeInTheDocument();
      expect(screen.getByTestId("record-payment-cancel")).toBeInTheDocument();
    });
  });

  it("T2 — pre-fills amount with remainingTtcCents / 100", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => {
      const amountInput = screen.getByTestId("record-payment-amount-input") as HTMLInputElement;
      expect(parseFloat(amountInput.value)).toBe(150);
    });
  });

  it("T3 — submit happy path calls createPaymentAction with cents", async () => {
    mockCreatePaymentAction.mockResolvedValue({ ok: true, data: { payment: {}, invoiceMarkedAsPaid: false } });
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockCreatePaymentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "inv-uuid-1",
          amountEurCents: 15000,
          method: "bank_transfer",
        }),
      );
    });
  });

  it("T4 — success closes dialog and calls toastResult", async () => {
    mockCreatePaymentAction.mockResolvedValue({ ok: true, data: { payment: {}, invoiceMarkedAsPaid: false } });
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockToastResult).toHaveBeenCalledWith(
        expect.objectContaining({ ok: true }),
        "Paiement enregistré",
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId("record-payment-dialog")).not.toBeInTheDocument();
    });
  });

  it("T5 — PAYMENT_OVERPAYMENT error shows custom toast", async () => {
    mockCreatePaymentAction.mockResolvedValue({
      ok: false,
      error: { code: "PAYMENT_OVERPAYMENT", message: "Overpayment", status: 400 },
    });
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Le montant excède le solde dû");
    });
  });

  it("T6 — PAYMENT_INVOICE_NOT_OPEN error shows custom toast", async () => {
    mockCreatePaymentAction.mockResolvedValue({
      ok: false,
      error: { code: "PAYMENT_INVOICE_NOT_OPEN", message: "Not open", status: 400 },
    });
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Le statut de la facture ne permet pas l'enregistrement d'un paiement",
      );
    });
  });

  it("T7 — validation rejects zero amount", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-amount-input"));
    fireEvent.change(screen.getByTestId("record-payment-amount-input"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockCreatePaymentAction).not.toHaveBeenCalled();
    });
  });

  it("T8 — submit button disabled during pending state", async () => {
    let resolveAction: (v: unknown) => void;
    mockCreatePaymentAction.mockReturnValue(
      new Promise((resolve) => { resolveAction = resolve; }),
    );
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("record-payment-submit")).toBeDisabled();
    });
    resolveAction!({ ok: true, data: { payment: {}, invoiceMarkedAsPaid: false } });
  });

  it("T9 — cancel closes dialog without submit", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-cancel"));
    fireEvent.click(screen.getByTestId("record-payment-cancel"));
    await waitFor(() => {
      expect(screen.queryByTestId("record-payment-dialog")).not.toBeInTheDocument();
    });
    expect(mockCreatePaymentAction).not.toHaveBeenCalled();
  });

  it("T10 — default fallback error uses toastResult", async () => {
    mockCreatePaymentAction.mockResolvedValue({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Server error", status: 500 },
    });
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-submit"));
    fireEvent.click(screen.getByTestId("record-payment-submit"));
    await waitFor(() => {
      expect(mockToastResult).toHaveBeenCalled();
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  it("T11 — method select has default value Virement", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-method-trigger"));
    expect(screen.getByTestId("record-payment-method-trigger")).toHaveTextContent("Virement");
  });

  it("T12 — method select dropdown contains 3 FR options: Carte bancaire, Virement, Autre", async () => {
    render(<RecordPaymentDialog {...DEFAULT_PROPS} />);
    openDialog();
    await waitFor(() => screen.getByTestId("record-payment-method-trigger"));
    const trigger = screen.getByTestId("record-payment-method-trigger");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
    await waitFor(() => {
      expect(screen.getByText("Carte bancaire")).toBeInTheDocument();
      expect(screen.getAllByText("Virement").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("Autre")).toBeInTheDocument();
    });
  });
});
