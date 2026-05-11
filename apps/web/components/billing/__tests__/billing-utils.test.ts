import { describe, it, expect } from "vitest";
import {
  formatPrice,
  getMonthlyPrice,
  getQuotaPercent,
  getQuotaVariant,
  getPlanBadgeVariant,
  getFeatureRows,
} from "../billing-utils";
import { PLANS } from "@saas/config";

describe("formatPrice", () => {
  it("formats cents to euros with 2 decimals", () => {
    expect(formatPrice(2900)).toBe("29,00");
    expect(formatPrice(9900)).toBe("99,00");
    expect(formatPrice(0)).toBe("0,00");
  });
});

describe("getMonthlyPrice", () => {
  it("returns monthly price for monthly period", () => {
    expect(getMonthlyPrice(PLANS.pro, "monthly")).toBe(2900);
  });

  it("returns yearly price divided by 12 for yearly period", () => {
    const result = getMonthlyPrice(PLANS.pro, "yearly");
    expect(result).toBe(Math.round(29000 / 12));
  });

  it("returns 0 for free plan", () => {
    expect(getMonthlyPrice(PLANS.free, "monthly")).toBe(0);
    expect(getMonthlyPrice(PLANS.free, "yearly")).toBe(0);
  });
});

describe("getQuotaPercent", () => {
  it("returns percentage of current vs max", () => {
    expect(getQuotaPercent(80, 100)).toBe(80);
    expect(getQuotaPercent(50, 200)).toBe(25);
  });

  it("returns 0 for unlimited (max = -1)", () => {
    expect(getQuotaPercent(100, -1)).toBe(0);
  });

  it("caps at 100", () => {
    expect(getQuotaPercent(150, 100)).toBe(100);
  });
});

describe("getQuotaVariant", () => {
  it("returns default below threshold", () => {
    expect(getQuotaVariant(50, 100, 80)).toBe("default");
  });

  it("returns warning at threshold", () => {
    expect(getQuotaVariant(80, 100, 80)).toBe("warning");
    expect(getQuotaVariant(95, 100, 80)).toBe("warning");
  });
});

describe("getPlanBadgeVariant", () => {
  it("returns default for active", () => {
    expect(getPlanBadgeVariant("active")).toBe("default");
  });

  it("returns secondary for trialing", () => {
    expect(getPlanBadgeVariant("trialing")).toBe("secondary");
  });

  it("returns destructive for past_due", () => {
    expect(getPlanBadgeVariant("past_due")).toBe("destructive");
  });

  it("returns outline for canceled", () => {
    expect(getPlanBadgeVariant("canceled")).toBe("outline");
  });
});

describe("getFeatureRows", () => {
  it("returns all 14 feature rows", () => {
    const rows = getFeatureRows();
    expect(rows).toHaveLength(14);
  });

  it("first row is Membres max with correct values", () => {
    const rows = getFeatureRows();
    expect(rows[0].label).toBe("Membres max");
    expect(rows[0].free).toBe("3");
    expect(rows[0].pro).toBe("10");
    expect(rows[0].business).toBe("50");
  });

  it("renders Illimité for -1 limits", () => {
    const rows = getFeatureRows();
    const contacts = rows.find((r) => r.label === "Contacts");
    expect(contacts?.business).toBe("Illimité");
  });

  it("renders check/cross for boolean features", () => {
    const rows = getFeatureRows();
    const agents = rows.find((r) => r.label === "Agents IA");
    expect(agents?.free).toBe("✗");
    expect(agents?.pro).toBe("✓");
    expect(agents?.business).toBe("✓");
  });
});
