// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteForm } from "../QuoteForm";
import type { Client, Project, Quote } from "@saas/db";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateQuoteAction = vi.fn();
const mockUpdateQuoteAction = vi.fn();
vi.mock("@/app/actions/quotes", () => ({
  createQuoteAction: (...args: unknown[]) => mockCreateQuoteAction(...args),
  updateQuoteAction: (...args: unknown[]) => mockUpdateQuoteAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { ok: boolean }) => result.ok),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const mockClients: Client[] = [
  {
    id: "c-1",
    name: "Acme Corp",
    slug: "acme",
    type: "company",
    email: null,
    phone: null,
    billingAddress: null,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Client[];

const mockProjects: Project[] = [
  {
    id: "p-1",
    clientId: "c-1",
    name: "Project Alpha",
    slug: "alpha",
    status: "active",
    description: null,
    startedAt: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Project[];

const mockQuote: Quote = {
  id: "q-1",
  clientId: "c-1",
  projectId: null,
  number: "DEV-001",
  status: "draft",
  issuedAt: null,
  expiresAt: null,
  acceptedAt: null,
  totalEurCents: 10000,
  vatRateBps: 2000,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Quote;

describe("QuoteForm", () => {
  it("T1 — create UI: affiche le sélecteur client et bouton Créer", () => {
    render(
      <QuoteForm clients={mockClients} projects={mockProjects} mode="create" />,
    );
    expect(screen.getByRole("button", { name: /créer le devis/i })).toBeInTheDocument();
    expect(screen.getByText("Sélectionner un client")).toBeInTheDocument();
  });

  it("T2 — edit lock: affiche le hint clientId verrouillé", () => {
    render(
      <QuoteForm
        initialData={mockQuote}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    const hint = screen.getByTestId("quote-clientId-lock-hint");
    expect(hint).toBeInTheDocument();
    expect(hint).toHaveTextContent("Le client ne peut pas être changé");
    expect(screen.getByRole("button", { name: /mettre à jour/i })).toBeInTheDocument();
  });

  it("T3 — BPS→%: vatRateBps 2000 affiché comme 20 dans le champ", () => {
    render(
      <QuoteForm
        initialData={mockQuote}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    const vatInput = screen.getByRole("spinbutton", { name: /taux tva/i });
    expect(vatInput).toHaveValue(20);
  });

  it("T4 — submit BPS: updateQuoteAction reçoit vatRateBps converti depuis %", async () => {
    mockUpdateQuoteAction.mockResolvedValue({ ok: true, data: mockQuote });

    render(
      <QuoteForm
        initialData={mockQuote}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: /taux tva/i }), {
      target: { valueAsNumber: 5.5 },
    });
    fireEvent.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await waitFor(() => {
      expect(mockUpdateQuoteAction).toHaveBeenCalledWith(
        "q-1",
        expect.objectContaining({ vatRateBps: 550 }),
      );
    });
  });

  it("T5 — no clientId payload: updateQuoteAction appelé sans clientId", async () => {
    mockUpdateQuoteAction.mockResolvedValue({ ok: true, data: mockQuote });

    render(
      <QuoteForm
        initialData={mockQuote}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await waitFor(() => {
      expect(mockUpdateQuoteAction).toHaveBeenCalledWith(
        "q-1",
        expect.not.objectContaining({ clientId: expect.anything() }),
      );
    });
  });
});
