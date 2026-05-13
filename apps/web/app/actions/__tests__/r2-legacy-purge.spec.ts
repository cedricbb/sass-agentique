import { describe, test, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const WEB = resolve(__dirname, "../../..");

describe("R2 legacy purge", () => {
  const deleted = [
    "app/(app)/onboarding/page.tsx",
    "app/actions/onboarding.ts",
    "app/api/billing/checkout/route.ts",
    "app/api/billing/portal/route.ts",
    "app/api/webhooks/stripe/route.ts",
    "components/auth/AcceptInvitationForm.tsx",
  ];

  test.each(deleted)("AC1 — %s is deleted", (rel) => {
    expect(existsSync(resolve(WEB, rel))).toBe(false);
  });

  describe("AC2+AC3 — auth.ts patched correctly", () => {
    const authPath = resolve(WEB, "app/actions/auth.ts");
    let content: string;

    beforeAll(() => {
      content = readFileSync(authPath, "utf-8");
    });

    test("no acceptInvitation reference remains", () => {
      expect(content).not.toMatch(/acceptInvitation/);
    });

    test("existing exports preserved", () => {
      expect(content).toMatch(/verifyEmailAction/);
      expect(content).toMatch(/loginAction/);
      expect(content).toMatch(/registerAction/);
    });
  });

  describe("AC4 — no legacy symbols in apps/web/", () => {
    const symbols = [
      "listTenantsByUser",
      "getTenantBySlug",
      "SubscriptionService",
      "acceptInvitation",
    ];

    test.each(symbols)("no %s in apps/web/", (sym) => {
      const count = execSync(
        `grep -rn "${sym}" "${WEB}" --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" | wc -l`,
        { encoding: "utf-8" },
      ).trim();
      expect(Number(count)).toBe(0);
    });
  });
});

describe("R3 legacy purge", () => {
  const deleted = [
    "contexts/TenantContext.tsx",
    "hooks/useAbility.ts",
    "components/permissions/Can.tsx",
    "components/layout/Sidebar.tsx",
    "components/layout/AppShell.tsx",
    "components/layout/Header.tsx",
  ];

  test.each(deleted)("AC1 — %s is deleted", (rel) => {
    expect(existsSync(resolve(WEB, rel))).toBe(false);
  });

  describe("AC4 — no R3 legacy symbols in apps/web/", () => {
    const symbols = [
      "TenantContext",
      "TenantProvider",
      "useTenant",
      "useAbility",
    ];

    test.each(symbols)("no %s in apps/web/", (sym) => {
      const count = execSync(
        `grep -rn "${sym}" "${WEB}" --include="*.ts" --include="*.tsx" --exclude-dir="__tests__" | wc -l`,
        { encoding: "utf-8" },
      ).trim();
      expect(Number(count)).toBe(0);
    });
  });
});
