import {
  db,
  quotes,
  quoteItems,
  quoteStatusEnum,
  type Quote,
  type NewQuote,
  type QuoteItem,
  type NewQuoteItem,
} from "@saas/db";
import { eq, and, inArray, desc } from "drizzle-orm";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];

export type QuoteAmounts = {
  totalHtCents: number;
  vatCents: number;
  totalTtcCents: number;
};

export type ListQuotesOptions = {
  clientId?: string;
  status?: QuoteStatus | QuoteStatus[];
};

export type CreateQuoteInput = Omit<NewQuote, "number" | "totalEurCents"> & {
  number?: string;
};

export type UpdateQuotePatch = Omit<
  Partial<NewQuote>,
  "status" | "totalEurCents" | "number"
>;

export type AddQuoteItemInput = Omit<NewQuoteItem, "quoteId">;

export type UpdateQuoteItemPatch = Partial<Omit<NewQuoteItem, "quoteId">>;

export class InvalidQuoteTransitionError extends Error {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Invalid transition from "${from}" to "${to}"`);
    this.name = "InvalidQuoteTransitionError";
  }
}

export const VALID_QUOTE_TRANSITIONS: Record<
  QuoteStatus,
  readonly QuoteStatus[]
> = {
  draft: ["sent"],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export function canTransitionQuote(
  from: QuoteStatus,
  to: QuoteStatus,
): boolean {
  return VALID_QUOTE_TRANSITIONS[from].includes(to);
}

export function computeQuoteTtc(quote: {
  totalEurCents: number;
  vatRateBps: number;
}): QuoteAmounts {
  const totalHtCents = quote.totalEurCents;
  const vatCents = Math.round(
    (totalHtCents * quote.vatRateBps) / 10000,
  );
  return {
    totalHtCents,
    vatCents,
    totalTtcCents: totalHtCents + vatCents,
  };
}

export async function generateQuoteNumber(
  year?: number,
): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const prefix = `Q-${y}-`;

  const [last] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.number, prefix))
    .orderBy(desc(quotes.number))
    .limit(1);

  if (!last) return `${prefix}001`;

  const suffix = last.number.slice(prefix.length);
  const parsed = parseInt(suffix, 10);
  if (isNaN(parsed)) {
    throw new Error(`Cannot parse last quote number: "${last.number}"`);
  }
  return `${prefix}${String(parsed + 1).padStart(3, "0")}`;
}

export async function listQuotes(
  opts?: ListQuotesOptions,
): Promise<Quote[]> {
  const conditions = [];
  if (opts?.clientId) {
    conditions.push(eq(quotes.clientId, opts.clientId));
  }
  if (opts?.status) {
    if (Array.isArray(opts.status)) {
      conditions.push(inArray(quotes.status, opts.status));
    } else {
      conditions.push(eq(quotes.status, opts.status));
    }
  }
  if (conditions.length === 0) {
    return db.select().from(quotes);
  }
  return db
    .select()
    .from(quotes)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));
}

export async function getQuoteById(id: string): Promise<Quote | null> {
  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, id))
    .limit(1);
  return row ?? null;
}

export async function getQuoteByNumber(
  number: string,
): Promise<Quote | null> {
  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.number, number))
    .limit(1);
  return row ?? null;
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<Quote> {
  const number = input.number ?? (await generateQuoteNumber());
  const [row] = await db
    .insert(quotes)
    .values({ ...input, number })
    .returning();
  return row;
}

export async function updateQuote(
  id: string,
  patch: UpdateQuotePatch,
): Promise<Quote | null> {
  const p = patch as Record<string, unknown>;
  if ("status" in p || "totalEurCents" in p || "number" in p) {
    throw new Error(
      "Use dedicated methods to change status, totalEurCents, or number.",
    );
  }
  const [row] = await db
    .update(quotes)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(quotes.id, id))
    .returning();
  return row ?? null;
}

export async function transitionQuoteStatus(
  id: string,
  newStatus: QuoteStatus,
): Promise<Quote | null> {
  const current = await getQuoteById(id);
  if (!current) return null;

  if (!canTransitionQuote(current.status as QuoteStatus, newStatus)) {
    throw new InvalidQuoteTransitionError(
      current.status as QuoteStatus,
      newStatus,
    );
  }

  const timestamps: Record<string, Date> = {};
  if (newStatus === "sent" && !current.issuedAt) {
    timestamps.issuedAt = new Date();
  }
  if (newStatus === "accepted" && !current.acceptedAt) {
    timestamps.acceptedAt = new Date();
  }

  const [row] = await db
    .update(quotes)
    .set({ status: newStatus, updatedAt: new Date(), ...timestamps })
    .where(eq(quotes.id, id))
    .returning();
  return row ?? null;
}

export async function deleteQuote(id: string): Promise<void> {
  await db.delete(quotes).where(eq(quotes.id, id));
}

export async function listQuoteItems(
  quoteId: string,
): Promise<QuoteItem[]> {
  return db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));
}

async function _recomputeInTx(
  tx: Tx,
  quoteId: string,
): Promise<number> {
  const items = await tx
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceEurCents,
    0,
  );

  await tx
    .update(quotes)
    .set({ totalEurCents: total, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
    .returning();

  return total;
}

export async function addQuoteItem(
  quoteId: string,
  item: AddQuoteItemInput,
): Promise<QuoteItem> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(quoteItems)
      .values({ ...item, quoteId })
      .returning();
    await _recomputeInTx(tx, quoteId);
    return row;
  });
}

export async function updateQuoteItem(
  itemId: string,
  patch: UpdateQuoteItemPatch,
): Promise<QuoteItem | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(quoteItems)
      .set(patch)
      .where(eq(quoteItems.id, itemId))
      .returning();
    if (!row) return null;
    await _recomputeInTx(tx, row.quoteId);
    return row;
  });
}

export async function removeQuoteItem(itemId: string): Promise<void> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(quoteItems)
      .where(eq(quoteItems.id, itemId))
      .returning();
    if (!deleted) return;
    await _recomputeInTx(tx, deleted.quoteId);
  });
}

export async function recomputeQuoteTotal(
  quoteId: string,
): Promise<number> {
  const items = await db
    .select()
    .from(quoteItems)
    .where(eq(quoteItems.quoteId, quoteId));

  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceEurCents,
    0,
  );

  await db
    .update(quotes)
    .set({ totalEurCents: total, updatedAt: new Date() })
    .where(eq(quotes.id, quoteId))
    .returning();

  return total;
}
