import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where",
    "insert", "values", "returning", "onConflictDoNothing",
    "update", "set",
    "limit",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  stripeEvents: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  lt: vi.fn((a: unknown, b: unknown) => ({ lt: [a, b] })),
}));

import {
  recordStripeEvent,
  markStripeEventProcessed,
  getStripeEvent,
  deleteStaleStripeEvents,
  STRIPE_EVENTS_RETENTION_DAYS,
} from "../stripe-event.service";

import * as barrel from "../index";

const RECORD = {
  id: "uuid-1",
  eventId: "evt_123",
  type: "invoice.paid",
  payloadJson: { object: "event" },
  receivedAt: new Date(),
  processedAt: null,
  createdAt: new Date(),
};

beforeEach(() => {
  dbMock = makeDrizzleMock();
});

describe("stripe-event service", () => {
  it("record_stripe_event_inserts_new_event", async () => {
    dbMock.returning = vi.fn().mockResolvedValue([RECORD]);

    const result = await recordStripeEvent({
      eventId: "evt_123",
      type: "invoice.paid",
      payload: { object: "event" },
    });

    expect(result.inserted).toBe(true);
    expect(result.record).toEqual(RECORD);
  });

  it("record_stripe_event_returns_inserted_false_on_duplicate", async () => {
    dbMock.returning = vi.fn().mockResolvedValue([]);
    dbMock.limit = vi.fn().mockResolvedValue([RECORD]);

    const result = await recordStripeEvent({
      eventId: "evt_123",
      type: "invoice.paid",
      payload: { object: "event" },
    });

    expect(result.inserted).toBe(false);
    expect(result.record).toEqual(RECORD);
  });

  it("mark_stripe_event_processed_updates_and_returns_record", async () => {
    const processed = { ...RECORD, processedAt: new Date() };
    dbMock.returning = vi.fn().mockResolvedValue([processed]);

    const result = await markStripeEventProcessed("evt_123");

    expect(result).not.toBeNull();
    expect(result!.processedAt).not.toBeNull();
  });

  it("mark_stripe_event_processed_returns_null_if_already_processed", async () => {
    dbMock.returning = vi.fn().mockResolvedValue([]);

    const result = await markStripeEventProcessed("evt_123");

    expect(result).toBeNull();
  });

  it("get_stripe_event_returns_record_or_null", async () => {
    dbMock.limit = vi.fn().mockResolvedValueOnce([RECORD]);

    const found = await getStripeEvent("evt_123");
    expect(found).toEqual(RECORD);

    dbMock.limit = vi.fn().mockResolvedValueOnce([]);
    const notFound = await getStripeEvent("evt_missing");
    expect(notFound).toBeNull();
  });

  it("stripe_event_service_exported_from_barrel", () => {
    expect(barrel.recordStripeEvent).toBeDefined();
    expect(barrel.markStripeEventProcessed).toBeDefined();
    expect(barrel.getStripeEvent).toBeDefined();
  });

  it("delete_stale_stripe_events_removes_old_rows", async () => {
    dbMock.returning = vi.fn().mockResolvedValue([RECORD, RECORD]);

    const result = await deleteStaleStripeEvents(90);

    expect(result).toEqual({ deletedCount: 2 });
  });

  it("delete_stale_stripe_events_returns_zero_when_no_stale_rows", async () => {
    dbMock.returning = vi.fn().mockResolvedValue([]);

    const result = await deleteStaleStripeEvents(90);

    expect(result).toEqual({ deletedCount: 0 });
  });

  it("delete_stale_stripe_events_throws_on_invalid_days", async () => {
    await expect(deleteStaleStripeEvents(0)).rejects.toThrow("olderThanDays must be > 0");
    await expect(deleteStaleStripeEvents(-1)).rejects.toThrow("olderThanDays must be > 0");
  });

  it("stripe_events_retention_days_exported_as_90", () => {
    expect(STRIPE_EVENTS_RETENTION_DAYS).toBe(90);
  });
});
