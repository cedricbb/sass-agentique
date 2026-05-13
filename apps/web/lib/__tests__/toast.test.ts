import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActionResult } from "@/lib/action-result";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast, toastResult } from "@/lib/toast";

describe("toastResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows success toast and returns true on ok result", () => {
    const result: ActionResult<string> = { ok: true, data: "done" };
    expect(toastResult(result, "OK")).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("OK");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows error toast and returns false on fail result", () => {
    const result: ActionResult<string> = {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Données invalides.", status: 400 },
    };
    expect(toastResult(result, "OK")).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Données invalides.");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("narrows type after guard returns true", () => {
    const result: ActionResult<{ id: number }> = { ok: true, data: { id: 42 } };
    if (toastResult(result, "OK")) {
      expect(result.data.id).toBe(42);
    } else {
      throw new Error("expected true");
    }
  });

  it("isolates mocks between ok and fail calls", () => {
    const ok: ActionResult<string> = { ok: true, data: "x" };
    const fail: ActionResult<string> = {
      ok: false,
      error: { code: "ERR", message: "boom", status: 500 },
    };
    toastResult(ok, "yes");
    toastResult(fail, "no");
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
