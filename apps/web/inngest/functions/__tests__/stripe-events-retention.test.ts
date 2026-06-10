import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockDeleteStaleStripeEvents = vi.fn();

vi.mock("@saas/services", () => ({
  deleteStaleStripeEvents: mockDeleteStaleStripeEvents,
  STRIPE_EVENTS_RETENTION_DAYS: 90,
}));

let capturedTrigger: { cron: string };
let capturedHandler: () => Promise<unknown>;

vi.mock("@saas/workflows", () => ({
  inngest: {
    createFunction: vi.fn(
      (
        config: { id: string },
        trigger: typeof capturedTrigger,
        handler: typeof capturedHandler,
      ) => {
        capturedTrigger = trigger;
        capturedHandler = handler;
        return { id: config.id };
      },
    ),
  },
}));

describe("stripeEventsRetentionCron", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retention_cron_registered_in_inngest_functions", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(4);
  });

  it("retention_cron_has_daily_schedule", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    expect(capturedTrigger).toEqual({ cron: "0 3 * * *" });
  });

  it("retention_cron_calls_delete_and_returns_count", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    mockDeleteStaleStripeEvents.mockResolvedValueOnce({ deletedCount: 5 });

    const result = await capturedHandler();

    expect(mockDeleteStaleStripeEvents).toHaveBeenCalledWith(90);
    expect(result).toEqual({ status: "completed", deletedCount: 5 });
  });

  it("retention_cron_function_config_id", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    const { inngest } = await import("@saas/workflows");
    const createFunction = inngest.createFunction as Mock;
    const callArgs = createFunction.mock.calls[0];
    const config = callArgs?.[0] as { id: string };
    expect(config.id).toBe("stripe-events-retention-cron");
  });
});
