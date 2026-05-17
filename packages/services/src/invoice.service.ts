import {
  db,
  type Invoice, type NewInvoice, type InvoiceItem, type NewInvoiceItem,
  invoiceStatusEnum,
  quotes, quoteItems, invoices, invoiceItems,
} from "@saas/db";
import { eq, and, inArray, desc, like } from "drizzle-orm";

type Db = typeof db;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = Db | Tx;

export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];

export class InvalidInvoiceTransitionError extends Error {
  constructor(from: InvoiceStatus, to: InvoiceStatus) {
    super(`Invalid transition from "${from}" to "${to}"`);
    this.name = "InvalidInvoiceTransitionError";
  }
}

export class InvalidQuoteForInvoicingError extends Error {
  constructor(quoteId: string, status: string) {
    super(`Quote "${quoteId}" has status "${status}", expected "accepted"`);
    this.name = "InvalidQuoteForInvoicingError";
  }
}

export class QuoteAlreadyInvoicedError extends Error {
  constructor(quoteId: string) {
    super(`Quote "${quoteId}" is already invoiced`);
    this.name = "QuoteAlreadyInvoicedError";
  }
}

export const VALID_INVOICE_TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["paid", "overdue", "cancelled"],
  overdue: ["paid", "cancelled"],
  paid: [],
  cancelled: [],
};

export function canTransitionInvoice(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_INVOICE_TRANSITIONS[from].includes(to);
}

export { computeInvoiceTtc, type InvoiceAmounts } from "./invoice.shared";

async function generateInvoiceNumberTx(dbOrTx: DbOrTx, year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `INV-${y}-`;

  const [last] = await dbOrTx
    .select()
    .from(invoices)
    .where(like(invoices.number, `${prefix}%`))
    .orderBy(desc(invoices.number))
    .limit(1);

  if (!last) return `${prefix}001`;

  const suffix = last.number.slice(prefix.length);
  const parsed = parseInt(suffix, 10);
  if (isNaN(parsed)) {
    throw new Error(`Cannot parse last invoice number: "${last.number}"`);
  }
  return `${prefix}${String(parsed + 1).padStart(3, "0")}`;
}

export async function generateInvoiceNumber(year?: number): Promise<string> {
  return generateInvoiceNumberTx(db, year);
}

export type ListInvoicesOptions = { clientId?: string; status?: InvoiceStatus | InvoiceStatus[] };
export type CreateInvoiceInput = Omit<NewInvoice, "number" | "totalEurCents"> & { number?: string };
export type UpdateInvoicePatch = Omit<Partial<NewInvoice>, "status" | "totalEurCents" | "number" | "paidAt">;

export async function listInvoices(opts?: ListInvoicesOptions): Promise<Invoice[]> {
  const conditions = [];
  if (opts?.clientId) {
    conditions.push(eq(invoices.clientId, opts.clientId));
  }
  if (opts?.status) {
    if (Array.isArray(opts.status)) {
      conditions.push(inArray(invoices.status, opts.status));
    } else {
      conditions.push(eq(invoices.status, opts.status));
    }
  }
  if (conditions.length === 0) {
    return db.select().from(invoices).orderBy(desc(invoices.createdAt));
  }
  return db
    .select()
    .from(invoices)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(invoices.createdAt));
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);
  return row ?? null;
}

export async function getInvoiceByNumber(number: string): Promise<Invoice | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.number, number))
    .limit(1);
  return row ?? null;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const number = input.number ?? (await generateInvoiceNumber());
  const [row] = await db
    .insert(invoices)
    .values({ ...input, number })
    .returning();
  return row;
}

export async function updateInvoice(id: string, patch: UpdateInvoicePatch): Promise<Invoice | null> {
  const p = patch as Record<string, unknown>;
  if ("status" in p || "totalEurCents" in p || "number" in p || "paidAt" in p) {
    throw new Error("Use dedicated methods to change status, totalEurCents, number, or paidAt.");
  }
  const [row] = await db
    .update(invoices)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return row ?? null;
}

export async function transitionInvoiceStatus(
  id: string,
  newStatus: InvoiceStatus,
): Promise<Invoice | null> {
  const current = await getInvoiceById(id);
  if (!current) return null;

  if (!canTransitionInvoice(current.status as InvoiceStatus, newStatus)) {
    throw new InvalidInvoiceTransitionError(current.status as InvoiceStatus, newStatus);
  }

  const timestamps: Record<string, Date> = {};
  if (newStatus === "sent" && !current.issuedAt) {
    timestamps.issuedAt = new Date();
  }
  if (newStatus === "paid" && !current.paidAt) {
    timestamps.paidAt = new Date();
  }

  const [row] = await db
    .update(invoices)
    .set({ status: newStatus, updatedAt: new Date(), ...timestamps })
    .where(eq(invoices.id, id))
    .returning();
  return row ?? null;
}

export async function deleteInvoice(id: string): Promise<void> {
  await db.delete(invoices).where(eq(invoices.id, id));
}

async function assertQuoteIsInvoiceable(tx: Tx, quoteId: string) {
  const [quote] = await tx
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!quote) throw new Error(`Quote not found: ${quoteId}`);

  if (quote.status !== "accepted") {
    throw new InvalidQuoteForInvoicingError(quoteId, quote.status);
  }

  const [existing] = await tx
    .select()
    .from(invoices)
    .where(eq(invoices.quoteId, quoteId))
    .limit(1);

  if (existing) throw new QuoteAlreadyInvoicedError(quoteId);

  return quote;
}

async function copyQuoteItemsToInvoice(tx: Tx, quoteId: string, invoiceId: string) {
  const items = await tx
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));

  if (items.length > 0) {
    await tx.insert(invoiceItems).values(
      items.map((qi) => ({
        invoiceId,
        description: qi.description,
        quantity: qi.quantity,
        unitPriceEurCents: qi.unitPriceEurCents,
        sortOrder: qi.sortOrder,
      })),
    );
  }
}

export async function createInvoiceFromQuote(quoteId: string): Promise<Invoice> {
  return db.transaction(async (tx) => {
    const quote = await assertQuoteIsInvoiceable(tx, quoteId);
    const number = await generateInvoiceNumberTx(tx);

    const [invoice] = await tx
      .insert(invoices)
      .values({
        clientId: quote.clientId,
        projectId: quote.projectId,
        quoteId,
        number,
        totalEurCents: quote.totalEurCents,
        vatRateBps: quote.vatRateBps,
        notes: quote.notes,
      })
      .returning();

    await copyQuoteItemsToInvoice(tx, quoteId, invoice.id);

    return invoice;
  });
}

export async function listInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  return db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));
}

async function _recomputeInTx(tx: Tx, invoiceId: string): Promise<number> {
  const items = await tx
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, invoiceId));

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceEurCents,
    0,
  );

  await tx
    .update(invoices)
    .set({ totalEurCents: total, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))
    .returning();

  return total;
}

export type AddInvoiceItemInput = Omit<NewInvoiceItem, "invoiceId">;
export type UpdateInvoiceItemPatch = Partial<Omit<NewInvoiceItem, "invoiceId">>;

export async function addInvoiceItem(
  invoiceId: string,
  item: AddInvoiceItemInput,
): Promise<InvoiceItem> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(invoiceItems)
      .values({ ...item, invoiceId })
      .returning();
    await _recomputeInTx(tx, invoiceId);
    return row;
  });
}

export async function updateInvoiceItem(
  itemId: string,
  patch: UpdateInvoiceItemPatch,
): Promise<InvoiceItem | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(invoiceItems)
      .set(patch)
      .where(eq(invoiceItems.id, itemId))
      .returning();
    if (!row) return null;
    await _recomputeInTx(tx, row.invoiceId);
    return row;
  });
}

export async function removeInvoiceItem(itemId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(invoiceItems)
      .where(eq(invoiceItems.id, itemId))
      .returning();
    if (!deleted) return;
    await _recomputeInTx(tx, deleted.invoiceId);
  });
}

export async function recomputeInvoiceTotal(invoiceId: string): Promise<number> {
  return _recomputeInTx(db as unknown as Tx, invoiceId);
}
