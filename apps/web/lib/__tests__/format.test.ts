import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/format";

function normalize(s: string): string {
  return s.replace(/[  ]/g, " ");
}

describe("formatCurrency", () => {
  it("formats a positive amount in EUR", () => {
    expect(normalize(formatCurrency(1234.5))).toBe("1 234,50 €");
  });

  it("formats zero", () => {
    expect(normalize(formatCurrency(0))).toBe("0,00 €");
  });

  it("returns fallback for null, undefined, NaN, Infinity", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency(NaN)).toBe("—");
    expect(formatCurrency(Infinity)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    expect(formatDate(new Date("2026-05-13T12:00:00Z"))).toBe("13/05/2026");
  });

  it("formats a string date", () => {
    expect(formatDate("2026-05-13T12:00:00Z")).toBe("13/05/2026");
  });

  it("returns fallback for invalid, null, undefined", () => {
    expect(formatDate("invalid")).toBe("—");
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("formats with Europe/Paris timezone", () => {
    expect(normalize(formatDateTime("2026-05-13T12:30:00Z"))).toBe("13/05/2026 14:30");
  });
});

describe("formatPercent", () => {
  it("formats with default 0 decimals and custom decimals, fallback for null", () => {
    expect(normalize(formatPercent(0.156))).toBe("16 %");
    expect(normalize(formatPercent(0.156, 1))).toBe("15,6 %");
    expect(formatPercent(null)).toBe("—");
  });
});
