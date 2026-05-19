import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getInvoiceById, listClients, listAllProjects, getQuoteById, listInvoiceItems, listPrestations, paymentService } from "@saas/services";
import { computeInvoiceTtc } from "@saas/services/invoice.shared";
import { InvoiceStatusActions } from "../_components/InvoiceStatusActions";
import { InvoiceForm } from "../_components/InvoiceForm";
import { InvoiceItemsEditor } from "../_components/InvoiceItemsEditor";
import { InvoiceAmountsCard } from "../_components/InvoiceAmountsCard";
import { InvoiceBalanceCard } from "../_components/InvoiceBalanceCard";
import { InvoicePaymentsList } from "../_components/InvoicePaymentsList";
import { RecordPaymentDialog } from "../_components/RecordPaymentDialog";

export const metadata: Metadata = { title: "Modifier la facture — Admin" };

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [invoice, clients, projects, prestations] = await Promise.all([
    getInvoiceById(id),
    listClients(),
    listAllProjects(),
    listPrestations(),
  ]);
  if (!invoice) notFound();

  const [items, balance, payments] = await Promise.all([
    listInvoiceItems(id),
    paymentService.computeInvoiceBalance(id),
    paymentService.listPaymentsByInvoice(id),
  ]);
  const amounts = computeInvoiceTtc(invoice);
  const canEdit = invoice.status === "draft";

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
      <section>
        <h2 className="text-xl font-semibold mb-4">Lignes de facture</h2>
        <InvoiceItemsEditor
          invoiceId={invoice.id}
          items={items}
          prestations={prestations}
          canEdit={canEdit}
        />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-4">Montants</h2>
        <InvoiceAmountsCard amounts={amounts} />
      </section>
      {invoice.status === "sent" && (
        <RecordPaymentDialog
          invoiceId={invoice.id}
          invoiceNumber={invoice.number}
          remainingTtcCents={Math.max(0, amounts.totalTtcCents - balance.paidCents)}
        />
      )}
      {["sent", "overdue", "paid"].includes(invoice.status) && (
        <section>
          <h2 className="text-xl font-semibold mb-4">Solde</h2>
          <InvoiceBalanceCard
            totalTtcCents={amounts.totalTtcCents}
            paidCents={balance.paidCents}
            status={invoice.status}
          />
          <InvoicePaymentsList
            invoiceId={invoice.id}
            invoiceStatus={invoice.status}
            payments={payments}
          />
        </section>
      )}
    </div>
  );
}
