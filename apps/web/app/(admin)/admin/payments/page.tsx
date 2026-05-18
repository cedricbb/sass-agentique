import type { Metadata } from "next";
import { listInvoices, listClients, paymentService } from "@saas/services";
import { listAllPaymentsSchema } from "@/lib/schemas/payment.schemas";
import { PaymentsTable } from "./_components/PaymentsTable";

export const metadata: Metadata = { title: "Paiements — Admin" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = listAllPaymentsSchema.safeParse(raw);
  const params = parsed.success
    ? parsed.data
    : { page: 1, perPage: 50, sort: "paidAt" as const, order: "desc" as const };

  const limit = params.perPage;
  const offset = (params.page - 1) * params.perPage;

  const [payments, invoices, clients] = await Promise.all([
    paymentService.listAllPayments({
      limit,
      offset,
      method: params.method,
      search: params.search,
    }),
    listInvoices(),
    listClients(),
  ]);

  const clientNameMap: Record<string, string> = Object.fromEntries(
    clients.map((c) => [c.id, c.name]),
  );

  const clientNames: Record<string, string> = Object.fromEntries(
    invoices.map((inv) => [inv.id, clientNameMap[inv.clientId] ?? "—"]),
  );

  const invoiceNumbers: Record<string, string> = Object.fromEntries(
    invoices.map((inv) => [inv.id, inv.number]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paiements</h1>
        <p className="text-sm text-muted-foreground">
          Gérez vos paiements ({payments.length})
        </p>
      </div>
      <PaymentsTable
        data={payments}
        clientNames={clientNames}
        invoiceNumbers={invoiceNumbers}
      />
    </div>
  );
}
