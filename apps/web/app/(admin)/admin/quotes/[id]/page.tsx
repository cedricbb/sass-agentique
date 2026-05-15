import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listClients, listAllProjects, getQuoteById } from "@saas/services";
import { computeQuoteTtc } from "@saas/services/quote.shared";
import { QuoteForm } from "../_components/QuoteForm";
import { QuoteAmountsCard } from "../_components/QuoteAmountsCard";
import { QuoteStatusActions } from "../_components/QuoteStatusActions";

export const metadata: Metadata = { title: "Modifier le devis — Admin" };

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, projects] = await Promise.all([
    getQuoteById(id),
    listClients(),
    listAllProjects(),
  ]);
  if (!quote) notFound();

  const amounts = computeQuoteTtc(quote);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-semibold mb-4">Montants</h2>
        <QuoteAmountsCard amounts={amounts} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Cycle de vie</h2>
        <QuoteStatusActions
          quoteId={quote.id}
          quoteNumber={quote.number}
          currentStatus={quote.status}
        />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Informations</h2>
        <QuoteForm initialData={quote} clients={clients} projects={projects} mode="edit" />
      </section>
    </div>
  );
}
