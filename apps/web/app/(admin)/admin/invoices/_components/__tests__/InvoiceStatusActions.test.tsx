// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceStatusActions } from "../InvoiceStatusActions";

const mockTransitionInvoiceStatusAction = vi.fn();
vi.mock("@/app/actions/invoices", () => ({
  transitionInvoiceStatusAction: (...args: unknown[]) =>
    mockTransitionInvoiceStatusAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("InvoiceStatusActions", () => {
  it("T1 — draft: affiche 2 boutons", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );
    expect(screen.getByRole("button", { name: /envoyer la facture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler la facture/i })).toBeInTheDocument();
  });

  it("T2 — sent: affiche 3 boutons", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="sent"
      />,
    );
    expect(screen.getByRole("button", { name: /marquer payée/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /marquer en retard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler la facture/i })).toBeInTheDocument();
  });

  it("T3 — overdue: affiche 2 boutons", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="overdue"
      />,
    );
    expect(screen.getByRole("button", { name: /marquer payée/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annuler la facture/i })).toBeInTheDocument();
  });

  it("T4 — paid: message terminal", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="paid"
      />,
    );
    expect(screen.getByText("Aucune action possible (état terminal).")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("T5 — cancelled: message terminal", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="cancelled"
      />,
    );
    expect(screen.getByText("Aucune action possible (état terminal).")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("T6 — trigger: ouvre dialog sans appeler action", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );
    fireEvent.click(screen.getByTestId("invoice-transition-sent-trigger"));
    expect(mockTransitionInvoiceStatusAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("T7 — confirm draft→sent: appelle action", async () => {
    mockTransitionInvoiceStatusAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-transition-sent-trigger"));
    fireEvent.click(screen.getByTestId("invoice-transition-sent-confirm"));

    await waitFor(() => {
      expect(mockTransitionInvoiceStatusAction).toHaveBeenCalledWith("inv-1", {
        targetStatus: "sent",
      });
    });
  });

  it("T8 — cancel dialog: ne déclenche pas action", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );
    fireEvent.click(screen.getByTestId("invoice-transition-sent-trigger"));
    fireEvent.click(screen.getByRole("button", { name: /annuler$/i }));
    expect(mockTransitionInvoiceStatusAction).not.toHaveBeenCalled();
  });

  it("T9 — bouton 'Envoyer la facture' variant default", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );
    const trigger = screen.getByTestId("invoice-transition-sent-trigger");
    expect(trigger).not.toHaveClass("destructive");
  });

  it("T10 — bouton 'Annuler la facture' variant destructive", () => {
    render(
      <InvoiceStatusActions
        invoiceId="inv-1"
        invoiceNumber="FAC-001"
        currentStatus="draft"
      />,
    );
    const trigger = screen.getByTestId("invoice-transition-cancelled-trigger");
    expect(trigger.className).toMatch(/destructive/);
  });
});
