import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

const mockDeleteStaleStripeEvents = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@saas/services/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
}));

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

  it("retention_emits_start_log", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    mockDeleteStaleStripeEvents.mockResolvedValueOnce({ deletedCount: 3 });

    await capturedHandler();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inngest.cron.stripe_events_retention.start",
      { jobName: "stripe_events_retention", retentionDays: 90 },
    );
  });

  it("retention_emits_purged_log", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    mockDeleteStaleStripeEvents.mockResolvedValueOnce({ deletedCount: 7 });

    await capturedHandler();

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "inngest.cron.stripe_events_retention.purged",
      { jobName: "stripe_events_retention", purgedCount: 7 },
    );
  });

  it("retention_emits_error_log_and_rethrows", async () => {
    await import("@/inngest/functions/stripe-events-retention");
    const boom = new Error("db error");
    mockDeleteStaleStripeEvents.mockRejectedValueOnce(boom);

    await expect(capturedHandler()).rejects.toThrow("db error");

    expect(mockLoggerError).toHaveBeenCalledWith(
      "inngest.cron.stripe_events_retention.error",
      { jobName: "stripe_events_retention", err: boom },
    );
  });
});
