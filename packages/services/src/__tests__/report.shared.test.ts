import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_KIND_LABELS, REPORT_KINDS, type ReportKind } from "../report.shared";

describe("report.shared", () => {
  it("resolves_report_shared_exports", () => {
    expect(REPORT_KINDS).toEqual(["delivery", "monthly", "audit", "other"]);
    expect(typeof REPORT_KIND_LABELS).toBe("object");
    const kind: ReportKind = "delivery";
    expect(REPORT_KIND_LABELS[kind]).toBe("Livraison");
    expect(REPORT_KIND_LABELS.monthly).toBe("Mensuel");
    expect(REPORT_KIND_LABELS.audit).toBe("Audit");
    expect(REPORT_KIND_LABELS.other).toBe("Autre");
  });

  it("report_shared_has_no_server_imports", () => {
    const src = readFileSync(join(__dirname, "../report.shared.ts"), "utf-8");
    expect(src).not.toMatch(/@saas\/db/);
    expect(src).not.toMatch(/drizzle-orm/);
    expect(src).not.toMatch(/from.*notification/);
    expect(src).not.toMatch(/server-only/);
  });

  it("backcompat_reexport_from_report_service", async () => {
    const { REPORT_KIND_LABELS: labelsFromService } = await import("../report.service");
    expect(labelsFromService).toBeDefined();
    expect(labelsFromService.delivery).toBe("Livraison");
  });
});
