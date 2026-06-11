import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockEnv = vi.hoisted(() => ({ LOG_LEVEL: "info" as "debug" | "info" | "warn" | "error" }));

vi.mock("@saas/config", () => ({
  env: mockEnv,
}));

import { logger } from "../logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockEnv.LOG_LEVEL = "info";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits_json_to_stdout_with_required_fields", () => {
    logger.info("test", { key: "val" });
    expect(console.info).toHaveBeenCalledOnce();
    const raw = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.level).toBe("info");
    expect(typeof parsed.timestamp).toBe("string");
    expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(parsed.message).toBe("test");
    expect(parsed.key).toBe("val");
  });

  it("serializes_error_with_name_message_stack", () => {
    const err = new Error("boom");
    logger.error("fail", { err });
    expect(console.error).toHaveBeenCalledOnce();
    const raw = (console.error as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.err).toBeDefined();
    expect(parsed.err.name).toBe("Error");
    expect(parsed.err.message).toBe("boom");
    expect(typeof parsed.err.stack).toBe("string");
    expect(parsed.err.stack.length).toBeGreaterThan(0);
  });

  it("suppresses_below_configured_level", () => {
    mockEnv.LOG_LEVEL = "warn";
    logger.debug("x");
    logger.info("x");
    expect(console.info).not.toHaveBeenCalled();
    logger.warn("x");
    expect(console.warn).toHaveBeenCalledOnce();
    logger.error("x");
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("emits_at_and_above_configured_level", () => {
    mockEnv.LOG_LEVEL = "warn";
    logger.warn("w");
    logger.error("e");
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
  });

  it("routes_debug_and_info_to_console_info", () => {
    mockEnv.LOG_LEVEL = "debug";
    logger.debug("d");
    logger.info("i");
    expect(console.info).toHaveBeenCalledTimes(2);
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("routes_warn_to_console_warn", () => {
    logger.warn("w");
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("routes_error_to_console_error", () => {
    logger.error("e");
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("handles_undefined_context", () => {
    expect(() => logger.info("no-ctx")).not.toThrow();
    expect(console.info).toHaveBeenCalledOnce();
    const raw = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0][0] as string;
    const parsed = JSON.parse(raw);
    expect(parsed.message).toBe("no-ctx");
    expect(parsed.level).toBe("info");
  });
});
