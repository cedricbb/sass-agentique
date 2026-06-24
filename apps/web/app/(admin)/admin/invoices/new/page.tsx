import type { Metadata } from "next";
import { listClients, listAllProjects, listQuotes, listInvoices, listClientContactsByOwner } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { InvoiceForm } from "../_components/InvoiceForm";

export const metadata: Metadata = { title: "Nouvelle facture — Admin" };

export default async function NewInvoicePage() {
  const user = await requireAdmin();

  const [clients, projects, allQuotes, allInvoices, contacts] = await Promise.all([
    listClients(),
    listAllProjects(),
    listQuotes({ status: ["accepted"] }),
    listInvoices(),
    listClientContactsByOwner(user.id),
  ]);

  const invoicedQuoteIds = new Set(
    allInvoices.filter((i) => i.quoteId).map((i) => i.quoteId!),
  );
  const acceptedQuotes = allQuotes.filter((q) => !invoicedQuoteIds.has(q.id));

  return (
    <InvoiceForm
      clients={clients}
      projects={projects}
      contacts={contacts}
      acceptedQuotes={acceptedQuotes}
      mode="create"
    />
  );
}
