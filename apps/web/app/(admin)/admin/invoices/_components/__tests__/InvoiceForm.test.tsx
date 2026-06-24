// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InvoiceForm } from "../InvoiceForm";
import type { Client, ClientContact, Project, Quote, Invoice } from "@saas/db";

Element.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockCreateInvoiceAction = vi.fn();
const mockCreateInvoiceFromQuoteAction = vi.fn();
const mockUpdateInvoiceAction = vi.fn();
vi.mock("@/app/actions/invoices", () => ({
  createInvoiceAction: (...args: unknown[]) => mockCreateInvoiceAction(...args),
  createInvoiceFromQuoteAction: (...args: unknown[]) => mockCreateInvoiceFromQuoteAction(...args),
  updateInvoiceAction: (...args: unknown[]) => mockUpdateInvoiceAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn((result: { success: boolean }) => result.success),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const mockContacts: ClientContact[] = [
  {
    id: "ct-1",
    clientId: "c-1",
    name: "Alice Martin",
    email: "alice@acme.com",
    userId: null,
    isPrimary: true,
    role: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ClientContact,
  {
    id: "ct-2",
    clientId: "c-2",
    name: "Bob Dupont",
    email: "bob@other.com",
    userId: null,
    isPrimary: false,
    role: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ClientContact,
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

const mockAcceptedQuotes: Quote[] = [
  {
    id: "q-1",
    clientId: "c-1",
    projectId: "p-1",
    number: "DEV-001",
    status: "accepted",
    issuedAt: null,
    expiresAt: null,
    acceptedAt: new Date(),
    totalEurCents: 10000,
    vatRateBps: 2000,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
] as Quote[];

const mockInvoice: Invoice = {
  id: "inv-1",
  clientId: "c-1",
  quoteId: null,
  projectId: "p-1",
  number: "FAC-001",
  status: "draft",
  issuedAt: null,
  dueAt: null,
  paidAt: null,
  totalEurCents: 10000,
  vatRateBps: 2000,
  stripePaymentIntentId: null,
  stripeCheckoutSessionId: null,
  notes: "some notes",
  createdAt: new Date(),
  updatedAt: new Date(),
} as Invoice;

const mockInvoiceSent: Invoice = {
  ...mockInvoice,
  status: "sent",
} as Invoice;

const mockInvoiceWithQuote: Invoice = {
  ...mockInvoice,
  quoteId: "q-1",
} as Invoice;

const mockInvoiceWithContact: Invoice = {
  ...mockInvoice,
  contactId: "ct-1",
} as Invoice;

describe("InvoiceForm", () => {
  it("T1 — create: renders tous les inputs", () => {
    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={mockAcceptedQuotes}
        mode="create"
      />,
    );
    expect(screen.getByTestId("invoice-clientId-select")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-quoteId-select")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-projectId-select")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-dueAt-input")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-vatRate-input")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-notes-input")).toBeInTheDocument();
  });

  it("T2 — create: submit vide → erreur validation client", async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );
    fireEvent.click(screen.getByTestId("invoice-submit"));
    await waitFor(() => {
      expect(screen.getByText("Sélectionner un client")).toBeInTheDocument();
    });
  });

  it("T3 — create: submit avec client → createInvoiceAction", async () => {
    mockCreateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockCreateInvoiceAction).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "c-1" }),
      );
    });
  });

  it("T4 — create: sélection quote → inputs disabled + hint", async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={mockAcceptedQuotes}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-quoteId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "DEV-001" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "DEV-001" }));

    await waitFor(() => {
      expect(screen.getByTestId("invoice-quote-source-hint")).toBeInTheDocument();
    });
    expect(screen.getByTestId("invoice-projectId-select")).toBeDisabled();
    expect(screen.getByTestId("invoice-dueAt-input")).toBeDisabled();
    expect(screen.getByTestId("invoice-vatRate-input")).toBeDisabled();
    expect(screen.getByTestId("invoice-notes-input")).toBeDisabled();
  });

  it("T5 — create: sélection quote + submit → createInvoiceFromQuoteAction", async () => {
    mockCreateInvoiceFromQuoteAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={mockAcceptedQuotes}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-quoteId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "DEV-001" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "DEV-001" }));

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockCreateInvoiceFromQuoteAction).toHaveBeenCalledWith({ quoteId: "q-1" });
      expect(mockCreateInvoiceAction).not.toHaveBeenCalled();
    });
  });

  it("T6 — create: sélection quote puis déselection → inputs réactivés", async () => {
    render(
      <InvoiceForm
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={mockAcceptedQuotes}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-quoteId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "DEV-001" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "DEV-001" }));

    fireEvent.click(screen.getByTestId("invoice-quoteId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Aucun devis source" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Aucun devis source" }));

    await waitFor(() => {
      expect(screen.queryByTestId("invoice-quote-source-hint")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("invoice-projectId-select")).not.toBeDisabled();
    expect(screen.getByTestId("invoice-dueAt-input")).not.toBeDisabled();
    expect(screen.getByTestId("invoice-vatRate-input")).not.toBeDisabled();
    expect(screen.getByTestId("invoice-notes-input")).not.toBeDisabled();
  });

  it("T7 — edit draft: client lock-hint, pas de select client", () => {
    render(
      <InvoiceForm
        initialData={mockInvoice}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    expect(screen.getByTestId("invoice-clientId-lock-hint")).toBeInTheDocument();
    expect(screen.queryByTestId("invoice-clientId-select")).not.toBeInTheDocument();
  });

  it("T8 — edit draft: sourceQuote → quote-source-display", () => {
    render(
      <InvoiceForm
        initialData={mockInvoiceWithQuote}
        clients={mockClients}
        projects={mockProjects}
        sourceQuote={mockAcceptedQuotes[0]}
        mode="edit"
      />,
    );
    const display = screen.getByTestId("invoice-quote-source-display");
    expect(display).toHaveTextContent("Issu du devis DEV-001");
  });

  it("T9 — edit draft: projectId et vatRate éditables", () => {
    render(
      <InvoiceForm
        initialData={mockInvoice}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    expect(screen.getByTestId("invoice-projectId-select")).not.toBeDisabled();
    expect(screen.getByTestId("invoice-vatRate-input")).not.toBeDisabled();
  });

  it("T10 — edit draft: submit → updateInvoiceAction avec projectId+vatRateBps+dueAt+notes", async () => {
    mockUpdateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        initialData={mockInvoice}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockUpdateInvoiceAction).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({
          dueAt: null,
          notes: "some notes",
          projectId: "p-1",
          vatRateBps: 2000,
        }),
      );
      const patch = mockUpdateInvoiceAction.mock.calls[0][1];
      expect(patch).not.toHaveProperty("clientId");
      expect(patch).not.toHaveProperty("quoteId");
    });
  });

  it("T11 — edit sent: projectId lock-hint, vatRate lock-hint", () => {
    render(
      <InvoiceForm
        initialData={mockInvoiceSent}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    expect(screen.getByTestId("invoice-projectId-lock-hint")).toBeInTheDocument();
    expect(screen.getByTestId("invoice-vatRate-lock-hint")).toBeInTheDocument();
  });

  it("T12 — edit sent: submit → updateInvoiceAction avec dueAt+notes UNIQUEMENT", async () => {
    mockUpdateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        initialData={mockInvoiceSent}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockUpdateInvoiceAction).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({ dueAt: null, notes: "some notes" }),
      );
      const patch = mockUpdateInvoiceAction.mock.calls[0][1];
      expect(patch).not.toHaveProperty("projectId");
      expect(patch).not.toHaveProperty("vatRateBps");
    });
  });

  it("contact_select_visible_when_client_selected", async () => {
    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );
    expect(screen.queryByTestId("invoice-contactId-select")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    await waitFor(() => {
      expect(screen.getByTestId("invoice-contactId-select")).toBeInTheDocument();
    });
  });

  it("contact_select_hidden_when_no_client", () => {
    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );
    expect(screen.queryByTestId("invoice-contactId-select")).not.toBeInTheDocument();
  });

  it("contact_reset_on_client_change", async () => {
    const twoClients: Client[] = [
      ...mockClients,
      {
        id: "c-2",
        name: "Beta Corp",
        slug: "beta",
        type: "company",
        email: null,
        phone: null,
        billingAddress: null,
        notes: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Client,
    ];

    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={twoClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    await waitFor(() => expect(screen.getByTestId("invoice-contactId-select")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("invoice-contactId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Alice Martin" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Alice Martin" }));

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Beta Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Beta Corp" }));

    await waitFor(() => {
      const trigger = screen.getByTestId("invoice-contactId-select");
      expect(trigger).toHaveTextContent("Aucun (entreprise seule)");
    });
  });

  it("contact_select_hidden_when_quote_selected", async () => {
    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={mockAcceptedQuotes}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    await waitFor(() => expect(screen.getByTestId("invoice-contactId-select")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("invoice-quoteId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "DEV-001" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "DEV-001" }));

    await waitFor(() => {
      expect(screen.queryByTestId("invoice-contactId-select")).not.toBeInTheDocument();
    });
  });

  it("contact_id_sent_on_create_submit", async () => {
    mockCreateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    await waitFor(() => expect(screen.getByTestId("invoice-contactId-select")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("invoice-contactId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Alice Martin" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Alice Martin" }));

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockCreateInvoiceAction).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: "ct-1" }),
      );
    });
  });

  it("contact_id_omitted_when_none_on_create", async () => {
    mockCreateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        acceptedQuotes={[]}
        mode="create"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-clientId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Acme Corp" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Acme Corp" }));

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      const args = mockCreateInvoiceAction.mock.calls[0][0];
      expect(args.contactId).toBeUndefined();
    });
  });

  it("contact_select_prefilled_on_edit", () => {
    render(
      <InvoiceForm
        initialData={mockInvoiceWithContact}
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );
    const trigger = screen.getByTestId("invoice-contactId-select");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("Alice Martin");
  });

  it("contact_id_sent_on_edit_submit", async () => {
    mockUpdateInvoiceAction.mockResolvedValue({ success: true, data: {} });

    render(
      <InvoiceForm
        initialData={mockInvoice}
        contacts={mockContacts}
        clients={mockClients}
        projects={mockProjects}
        mode="edit"
      />,
    );

    fireEvent.click(screen.getByTestId("invoice-contactId-select"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Alice Martin" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Alice Martin" }));

    fireEvent.click(screen.getByTestId("invoice-submit"));

    await waitFor(() => {
      expect(mockUpdateInvoiceAction).toHaveBeenCalledWith(
        "inv-1",
        expect.objectContaining({ contactId: "ct-1" }),
      );
    });
  });
});
