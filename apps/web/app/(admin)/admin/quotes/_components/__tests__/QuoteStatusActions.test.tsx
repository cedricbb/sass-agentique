// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteStatusActions } from "../QuoteStatusActions";

const mockTransitionQuoteStatusAction = vi.fn();
vi.mock("@/app/actions/quotes", () => ({
  transitionQuoteStatusAction: (...args: unknown[]) =>
    mockTransitionQuoteStatusAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("QuoteStatusActions", () => {
  it("T1 — draft: affiche 1 bouton 'Envoyer le devis'", () => {
    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="draft"
      />,
    );
    expect(screen.getByRole("button", { name: /envoyer le devis/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /marquer/i })).not.toBeInTheDocument();
  });

  it("T2 — sent: affiche 3 boutons de transition", () => {
    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="sent"
      />,
    );
    expect(screen.getByRole("button", { name: /marquer accepté/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /marquer refusé/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /marquer expiré/i })).toBeInTheDocument();
  });

  it("T3 — accepted: affiche message état terminal, 0 bouton", () => {
    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="accepted"
      />,
    );
    expect(
      screen.getByText("Aucune action possible (état terminal)."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("T4 — declined et expired: message état terminal affiché", () => {
    const { unmount } = render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="declined"
      />,
    );
    expect(
      screen.getByText("Aucune action possible (état terminal)."),
    ).toBeInTheDocument();
    unmount();

    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="expired"
      />,
    );
    expect(
      screen.getByText("Aucune action possible (état terminal)."),
    ).toBeInTheDocument();
  });

  it("T5 — trigger: cliquer le bouton ouvre le dialog sans appeler l'action", () => {
    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="draft"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /envoyer le devis/i }));
    expect(mockTransitionQuoteStatusAction).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("T6 — confirm: appelle transitionQuoteStatusAction avec objet { targetStatus }", async () => {
    mockTransitionQuoteStatusAction.mockResolvedValue({ ok: true, data: {} });

    render(
      <QuoteStatusActions
        quoteId="q-1"
        quoteNumber="DEV-001"
        currentStatus="draft"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /envoyer le devis/i }));
    const confirmBtn = screen.getByRole("button", { name: /confirmer/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockTransitionQuoteStatusAction).toHaveBeenCalledWith("q-1", {
        targetStatus: "sent",
      });
    });
  });
});
