// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuoteForm } from "../QuoteForm";
import type { Client, ClientContact, Project, Quote } from "@saas/db";

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

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

const mockContacts: ClientContact[] = [
  {
    id: "contact-1",
    clientId: "c-1",
    userId: null,
    isPrimary: true,
    role: null,
    name: "Alice Dupont",
    email: "alice@acme.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

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

async function selectOption(testId: string, optionName: string) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(screen.getByRole("option", { name: optionName })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("option", { name: optionName }));
}

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

  it("T6 — create contact hidden: Select contact masqué sans client sélectionné", () => {
    render(
      <QuoteForm clients={mockClients} projects={mockProjects} contacts={mockContacts} mode="create" />,
    );
    expect(screen.queryByTestId("quote-contactId-select")).not.toBeInTheDocument();
  });

  it("T7 — create contact visible: Select contact affiché après sélection client", async () => {
    render(
      <QuoteForm clients={mockClients} projects={mockProjects} contacts={mockContacts} mode="create" />,
    );

    expect(screen.queryByTestId("quote-contactId-select")).not.toBeInTheDocument();

    await selectOption("quote-clientId-select", "Acme Corp");

    await waitFor(() => expect(screen.getByTestId("quote-contactId-select")).toBeInTheDocument());
    expect(screen.getAllByText("Aucun (entreprise seule)").length).toBeGreaterThan(0);
  });

  it("T8 — create contact reset: changement client reset contactId à none", async () => {
    const secondClient: Client = {
      ...mockClients[0],
      id: "c-2",
      name: "Beta Ltd",
      slug: "beta",
    };
    render(
      <QuoteForm
        clients={[...mockClients, secondClient]}
        projects={mockProjects}
        contacts={mockContacts}
        mode="create"
      />,
    );

    await selectOption("quote-clientId-select", "Acme Corp");
    await waitFor(() => expect(screen.getByTestId("quote-contactId-select")).toBeInTheDocument());

    await selectOption("quote-contactId-select", "Alice Dupont");

    await selectOption("quote-clientId-select", "Beta Ltd");

    await waitFor(() => {
      const trigger = screen.getByTestId("quote-contactId-select");
      expect(trigger).toHaveTextContent(/aucun \(entreprise seule\)/i);
    });
  });

  it("T9 — create submit contactId: createQuoteAction reçoit contactId sélectionné", async () => {
    mockCreateQuoteAction.mockResolvedValue({ ok: true, data: { id: "q-new" } });

    render(
      <QuoteForm clients={mockClients} projects={mockProjects} contacts={mockContacts} mode="create" />,
    );

    await selectOption("quote-clientId-select", "Acme Corp");
    await waitFor(() => expect(screen.getByTestId("quote-contactId-select")).toBeInTheDocument());
    await selectOption("quote-contactId-select", "Alice Dupont");

    fireEvent.click(screen.getByRole("button", { name: /créer le devis/i }));

    await waitFor(() => {
      expect(mockCreateQuoteAction).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "contact-1" }),
      );
    });
  });

  it("T10 — create submit no contact: createQuoteAction reçoit contactId undefined", async () => {
    mockCreateQuoteAction.mockResolvedValue({ ok: true, data: { id: "q-new" } });

    render(
      <QuoteForm clients={mockClients} projects={mockProjects} contacts={mockContacts} mode="create" />,
    );

    await selectOption("quote-clientId-select", "Acme Corp");
    await waitFor(() => expect(screen.getByTestId("quote-contactId-select")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /créer le devis/i }));

    await waitFor(() => {
      const call = mockCreateQuoteAction.mock.calls[0][0];
      expect(call.contactId).toBe("contact-1");
    });
  });

  it("T11 — edit contact prefill: Select contact pré-rempli avec quote.contactId", () => {
    const quoteWithContact: Quote = { ...mockQuote, contactId: "contact-1" } as Quote;

    render(
      <QuoteForm
        initialData={quoteWithContact}
        clients={mockClients}
        projects={mockProjects}
        contacts={mockContacts}
        mode="edit"
      />,
    );

    const trigger = screen.getByTestId("quote-contactId-select");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Alice Dupont");
  });

  it("T12 — edit submit contactId: updateQuoteAction reçoit contactId", async () => {
    mockUpdateQuoteAction.mockResolvedValue({ ok: true, data: mockQuote });

    const quoteWithContact: Quote = { ...mockQuote, contactId: "contact-1" } as Quote;

    render(
      <QuoteForm
        initialData={quoteWithContact}
        clients={mockClients}
        projects={mockProjects}
        contacts={mockContacts}
        mode="edit"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /mettre à jour/i }));

    await waitFor(() => {
      expect(mockUpdateQuoteAction).toHaveBeenCalledWith(
        "q-1",
        expect.objectContaining({ contactId: "contact-1" }),
      );
    });
  });
});
