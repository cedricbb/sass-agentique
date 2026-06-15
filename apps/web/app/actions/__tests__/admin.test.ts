import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  resetUserTotp: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { banUserAction, unbanUserAction } from "../admin";
import { banUser, unbanUser } from "@saas/services";
import { requireAdmin } from "@/lib/auth";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedBanUser = vi.mocked(banUser);
const mockedUnbanUser = vi.mocked(unbanUser);

const fakeAdmin = { id: "a1", role: "admin" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
});

describe("banUserAction", () => {
  it("ban_user_action_returns_action_result_ok", async () => {
    mockedBanUser.mockResolvedValue(undefined as never);
    const result = await banUserAction("u-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(mockedBanUser).toHaveBeenCalledWith("u-1");
  });

  it("ban_user_action_returns_action_result_error", async () => {
    mockedBanUser.mockRejectedValue(new Error("service error"));
    const result = await banUserAction("u-1");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });
});

describe("unbanUserAction", () => {
  it("unban_user_action_returns_action_result_ok", async () => {
    mockedUnbanUser.mockResolvedValue(undefined as never);
    const result = await unbanUserAction("u-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(mockedUnbanUser).toHaveBeenCalledWith("u-1");
  });
});
