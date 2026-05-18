import { db, type Payment, type NewPayment, payments, invoices } from "@saas/db";
import { eq, sql, asc, desc, ilike, and } from "drizzle-orm";
import * as invoiceService from "./invoice.service";

export interface ListAllPaymentsParams {
  limit?: number;
  offset?: number;
  method?: "stripe_card" | "bank_transfer" | "other";
  search?: string;
}

export async function listAllPayments(params?: ListAllPaymentsParams): Promise<Payment[]> {
  const limit = Math.max(1, Math.min(params?.limit ?? 50, 200));
  const offset = Math.max(0, params?.offset ?? 0);

  const conditions = [];
  if (params?.method) {
    conditions.push(eq(payments.method, params.method));
  }
  if (params?.search) {
    conditions.push(ilike(payments.externalRef, `%${params.search}%`));
  }

  const query = db.select().from(payments);
  const withWhere = conditions.length > 0
    ? query.where(conditions.length === 1 ? conditions[0]! : and(...conditions))
    : query;

  return withWhere
    .orderBy(desc(payments.paidAt))
    .limit(limit)
    .offset(offset);
}

type Db = typeof db;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = Db | Tx;

export class PaymentDeletionOnPaidInvoiceError extends Error {
  constructor(invoiceId: string) {
    super(`Cannot delete payment on paid invoice "${invoiceId}"`);
    this.name = "PaymentDeletionOnPaidInvoiceError";
  }
}

export async function listPaymentsByInvoice(invoiceId: string): Promise<Payment[]> {
  return db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(asc(payments.paidAt));
}

export async function getPaymentById(id: string): Promise<Payment | null> {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);
  return row ?? null;
}

export async function computeInvoiceBalance(
  invoiceId: string,
  tx?: DbOrTx,
): Promise<{ totalCents: number; paidCents: number; balanceCents: number; isFullyPaid: boolean }> {
  const runner = tx ?? db;

  const [inv] = await runner
    .select({ totalEurCents: invoices.totalEurCents })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!inv) return { totalCents: 0, paidCents: 0, balanceCents: 0, isFullyPaid: false };

  const totalCents = inv.totalEurCents;

  const [row] = await runner
    .select({ sum: sql<number>`COALESCE(SUM(${payments.amountEurCents}), 0)::int` })
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId));

  const paidCents = row?.sum ?? 0;

  return {
    totalCents,
    paidCents,
    balanceCents: totalCents - paidCents,
    isFullyPaid: paidCents >= totalCents,
  };
}

export async function createPayment(
  input: NewPayment,
): Promise<{ payment: Payment; invoiceMarkedAsPaid: boolean }> {
  return db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(payments)
      .values(input)
      .returning();

    const balance = await computeInvoiceBalance(input.invoiceId, tx);

    let invoiceMarkedAsPaid = false;

    if (balance.isFullyPaid) {
      const [inv] = await tx
        .select({ status: invoices.status })
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);

      if (inv && inv.status !== "paid") {
        await invoiceService.transitionInvoiceStatus(input.invoiceId, "paid");
        invoiceMarkedAsPaid = true;
      }
    }

    return { payment, invoiceMarkedAsPaid };
  });
}

export async function deletePayment(id: string): Promise<boolean> {
  const [row] = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      invoiceStatus: invoices.status,
    })
    .from(payments)
    .where(eq(payments.id, id))
    .limit(1);

  if (!row) return false;

  if (row.invoiceStatus === "paid") {
    throw new PaymentDeletionOnPaidInvoiceError(row.invoiceId);
  }

  await db.delete(payments).where(eq(payments.id, id));
  return true;
}

export async function recomputePaidAtForInvoice(
  invoiceId: string,
  tx?: DbOrTx,
): Promise<{ wasMarkedAsPaid: boolean }> {
  const runner = tx ?? db;
  const balance = await computeInvoiceBalance(invoiceId, runner);

  if (balance.isFullyPaid) {
    const [inv] = await runner
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (inv && inv.status !== "paid") {
      await invoiceService.transitionInvoiceStatus(invoiceId, "paid");
      return { wasMarkedAsPaid: true };
    }
  }

  return { wasMarkedAsPaid: false };
}
