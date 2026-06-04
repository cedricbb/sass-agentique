import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  validateSession: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserSocialLinks: vi.fn(),
  changeUserPassword: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/schemas/profile.schemas", () => ({
  changePasswordSchema: {
    parse: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "session-token" }),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { changeAdminPasswordAction } from "../profile";
import { changeUserPassword } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/schemas/profile.schemas";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedChangeUserPassword = vi.mocked(changeUserPassword);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedSchemaParse = vi.mocked(changePasswordSchema.parse);

const adminUser = {
  id: "admin-1",
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
  emailVerified: true,
  bio: null,
  location: null,
  website: null,
  socialLinks: null,
};

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }
  return fd;
}

describe("changeAdminPasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(adminUser);
    mockedChangeUserPassword.mockResolvedValue(undefined);
    mockedSchemaParse.mockReturnValue({
      oldPassword: "oldpass",
      newPassword: "newpass12",
      confirmNewPassword: "newpass12",
    });
  });

  it("returns null on successful password change", async () => {
    const formData = makeFormData({
      oldPassword: "oldpass",
      newPassword: "newpass12",
      confirmNewPassword: "newpass12",
    });

    const result = await changeAdminPasswordAction(null, formData);

    expect(result).toBeNull();
    expect(mockedChangeUserPassword).toHaveBeenCalledWith("admin-1", "oldpass", "newpass12");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/profile");
  });

  it("returns error when old password is wrong", async () => {
    mockedChangeUserPassword.mockRejectedValueOnce(new Error("INVALID_PASSWORD"));

    const formData = makeFormData({
      oldPassword: "wrong",
      newPassword: "newpass12",
      confirmNewPassword: "newpass12",
    });

    const result = await changeAdminPasswordAction(null, formData);

    expect(result).toEqual({ error: "Mot de passe actuel incorrect" });
  });

  it("returns validation error on invalid input", async () => {
    mockedSchemaParse.mockImplementationOnce(() => {
      throw new ZodError([
        {
          code: "too_small",
          minimum: 8,
          type: "string",
          inclusive: true,
          exact: false,
          message: "Au moins 8 caractères",
          path: ["newPassword"],
        },
      ]);
    });

    const formData = makeFormData({
      oldPassword: "oldpass",
      newPassword: "short",
      confirmNewPassword: "short",
    });

    const result = await changeAdminPasswordAction(null, formData);

    expect(result).toEqual({ error: "Au moins 8 caractères" });
    expect(mockedChangeUserPassword).not.toHaveBeenCalled();
  });
});
