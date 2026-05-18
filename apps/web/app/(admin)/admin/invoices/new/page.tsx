import type { Metadata } from "next";
import { listClients, listAllProjects, listQuotes, listInvoices } from "@saas/services";
import { InvoiceForm } from "../_components/InvoiceForm";

export const metadata: Metadata = { title: "Nouvelle facture — Admin" };

export default async function NewInvoicePage() {
  const [clients, projects, allQuotes, allInvoices] = await Promise.all([
    listClients(),
    listAllProjects(),
    listQuotes({ status: ["accepted"] }),
    listInvoices(),
  ]);

  const invoicedQuoteIds = new Set(
    allInvoices.filter((i) => i.quoteId).map((i) => i.quoteId!),
  );
  const acceptedQuotes = allQuotes.filter((q) => !invoicedQuoteIds.has(q.id));

  return (
    <InvoiceForm
      clients={clients}
      projects={projects}
      acceptedQuotes={acceptedQuotes}
      mode="create"
    />
  );
}
