import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getInvoiceById, listClients, listAllProjects, getQuoteById } from "@saas/services";
import { InvoiceStatusActions } from "../_components/InvoiceStatusActions";
import { InvoiceForm } from "../_components/InvoiceForm";

export const metadata: Metadata = { title: "Modifier la facture — Admin" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, projects] = await Promise.all([
    getInvoiceById(id),
    listClients(),
    listAllProjects(),
  ]);
  if (!invoice) notFound();

  const sourceQuote = invoice.quoteId ? await getQuoteById(invoice.quoteId) : null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-4">Cycle de vie</h2>
        <InvoiceStatusActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          currentStatus={invoice.status}
        />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Informations</h2>
        <InvoiceForm
          initialData={invoice}
          clients={clients}
          projects={projects}
          sourceQuote={sourceQuote}
          mode="edit"
        />
      </section>
    </div>
  );
}
