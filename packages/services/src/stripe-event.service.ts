import { db, stripeEvents, type StripeEvent } from "@saas/db";
import { eq, and, isNull } from "drizzle-orm";

export type StripeEventRecord = StripeEvent;

export async function recordStripeEvent(input: {
  eventId: string;
  type: string;
  payload: unknown;
}): Promise<{ inserted: boolean; record: StripeEventRecord }> {
  const rows = await db
    .insert(stripeEvents)
    .values({
      eventId: input.eventId,
      type: input.type,
      payloadJson: input.payload,
    })
    .onConflictDoNothing()
    .returning();

  if (rows.length > 0) {
    return { inserted: true, record: rows[0] };
  }

  const existing = await getStripeEvent(input.eventId);
  return { inserted: false, record: existing! };
}

export async function markStripeEventProcessed(
  eventId: string,
): Promise<StripeEventRecord | null> {
  const rows = await db
    .update(stripeEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(stripeEvents.eventId, eventId), isNull(stripeEvents.processedAt)))
    .returning();

  return rows[0] ?? null;
}

export async function getStripeEvent(
  eventId: string,
): Promise<StripeEventRecord | null> {
  const rows = await db
    .select()
    .from(stripeEvents)
    .where(eq(stripeEvents.eventId, eventId))
    .limit(1);

  return rows[0] ?? null;
}
