import { describe, it, expect } from "vitest";
import { createAbility } from "../ability";
import type { Subject } from "../types";

describe("createAbility('admin')", () => {
  const ability = createAbility("admin");

  const subjects: Subject[] = [
    "Client",
    "Project",
    "Prestation",
    "Quote",
    "Invoice",
    "Payment",
    "Report",
    "MaintenanceContract",
  ];

  for (const subject of subjects) {
    it(`can manage ${subject}`, () => {
      expect(ability.can("manage", subject)).toBe(true);
    });
  }
});

describe("createAbility('client')", () => {
  const ability = createAbility("client");

  it("cannot manage any subject", () => {
    expect(ability.can("manage", "Client")).toBe(false);
    expect(ability.can("manage", "Project")).toBe(false);
    expect(ability.can("manage", "Invoice")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });
});

describe("runtime safety", () => {
  it("unknown role returns empty ability", () => {
    const ability = createAbility("unknown" as any);
    expect(ability.can("manage", "Client")).toBe(false);
  });
});
