import { describe, it, expect } from "vitest";
import { changePasswordSchema } from "../profile.schemas";

describe("changePasswordSchema", () => {
  it("accepts valid change password input", () => {
    const input = {
      oldPassword: "currentpass",
      newPassword: "newpass12",
      confirmNewPassword: "newpass12",
    };
    expect(() => changePasswordSchema.parse(input)).not.toThrow();
  });

  it("rejects new password under 8 chars", () => {
    const result = changePasswordSchema.safeParse({
      oldPassword: "currentpass",
      newPassword: "short",
      confirmNewPassword: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.errors.map((e) => e.message);
      expect(messages).toContain("Au moins 8 caractères");
    }
  });

  it("rejects mismatched confirm password", () => {
    const result = changePasswordSchema.safeParse({
      oldPassword: "currentpass",
      newPassword: "newpass12",
      confirmNewPassword: "different12",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.errors.find(
        (e) => e.path.includes("confirmNewPassword"),
      );
      expect(confirmError?.message).toBe("Les mots de passe ne correspondent pas");
    }
  });
});
