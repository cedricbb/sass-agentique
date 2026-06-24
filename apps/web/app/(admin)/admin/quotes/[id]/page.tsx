import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download } from "lucide-react";
import { listClients, listAllProjects, getQuoteById, listQuoteItems, listPrestations, listInvoices, listClientContacts } from "@saas/services";
import { computeQuoteTtc } from "@saas/services/quote.shared";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "../_components/QuoteForm";
import { QuoteAmountsCard } from "../_components/QuoteAmountsCard";
import { QuoteStatusActions } from "../_components/QuoteStatusActions";
import { QuoteItemsEditor } from "../_components/QuoteItemsEditor";
import { QuoteToInvoiceButton } from "../_components/QuoteToInvoiceButton";

export const metadata: Metadata = { title: "Modifier le devis — Admin" };

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, projects, items, prestations, invoices] = await Promise.all([
    getQuoteById(id),
    listClients(),
    listAllProjects(),
    listQuoteItems(id),
    listPrestations(),
    listInvoices(),
  ]);
  if (!quote) notFound();

  const contacts = await listClientContacts(quote.clientId);

  const amounts = computeQuoteTtc(quote);
  const alreadyInvoiced = invoices.some((inv) => inv.quoteId === quote.id);
  const canEdit = quote.status === "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{quote.number}</h1>
        {quote.issuedAt != null && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/quotes/${quote.id}/file`} download={`devis-${quote.number}.pdf`}>
              <Download className="mr-2 h-4 w-4" /> Télécharger le PDF
            </a>
          </Button>
        )}
      </div>
      <section>
        <h2 className="text-xl font-semibold mb-4">Lignes du devis</h2>
        <QuoteItemsEditor
          quoteId={quote.id}
          items={items}
          prestations={prestations}
          canEdit={canEdit}
        />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Montants</h2>
        <QuoteAmountsCard amounts={amounts} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Cycle de vie</h2>
        {quote.status === "accepted" && (
          <QuoteToInvoiceButton quoteId={quote.id} alreadyInvoiced={alreadyInvoiced} />
        )}
        <QuoteStatusActions
          quoteId={quote.id}
          quoteNumber={quote.number}
          currentStatus={quote.status}
        />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Informations</h2>
        <QuoteForm initialData={quote} clients={clients} projects={projects} contacts={contacts} mode="edit" />
      </section>
    </div>
  );
}
