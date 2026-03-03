import { describe, it, expect } from "vitest";
import { createAbility } from "../ability";

// ── OWNER ──────────────────────────────────────────────────────────────────────

describe("OWNER", () => {
  const ability = createAbility("OWNER");

  it("can read Tenant", () => expect(ability.can("read", "Tenant")).toBe(true));
  it("can update Tenant", () => expect(ability.can("update", "Tenant")).toBe(true));
  it("can read Member", () => expect(ability.can("read", "Member")).toBe(true));
  it("can invite Member", () => expect(ability.can("invite", "Member")).toBe(true));
  it("can remove Member", () => expect(ability.can("remove", "Member")).toBe(true));
  it("can update MemberRole", () => expect(ability.can("update", "Member")).toBe(true));
  it("can read Invitation", () => expect(ability.can("read", "Invitation")).toBe(true));
  it("can cancel Invitation", () => expect(ability.can("cancel", "Invitation")).toBe(true));
});

// ── ADMIN ──────────────────────────────────────────────────────────────────────

describe("ADMIN", () => {
  const ability = createAbility("ADMIN");

  it("can read Tenant", () => expect(ability.can("read", "Tenant")).toBe(true));
  it("cannot update Tenant", () => expect(ability.cannot("update", "Tenant")).toBe(true));
  it("can read Member", () => expect(ability.can("read", "Member")).toBe(true));
  it("can invite Member", () => expect(ability.can("invite", "Member")).toBe(true));
  it("can remove Member", () => expect(ability.can("remove", "Member")).toBe(true));
  it("cannot update MemberRole", () => expect(ability.cannot("update", "Member")).toBe(true));
  it("can read Invitation", () => expect(ability.can("read", "Invitation")).toBe(true));
  it("can cancel Invitation", () => expect(ability.can("cancel", "Invitation")).toBe(true));
});

// ── MEMBER ─────────────────────────────────────────────────────────────────────

describe("MEMBER", () => {
  const ability = createAbility("MEMBER");

  it("can read Tenant", () => expect(ability.can("read", "Tenant")).toBe(true));
  it("cannot update Tenant", () => expect(ability.cannot("update", "Tenant")).toBe(true));
  it("can read Member", () => expect(ability.can("read", "Member")).toBe(true));
  it("cannot invite Member", () => expect(ability.cannot("invite", "Member")).toBe(true));
  it("cannot remove Member", () => expect(ability.cannot("remove", "Member")).toBe(true));
  it("cannot read Invitation", () => expect(ability.cannot("read", "Invitation")).toBe(true));
  it("cannot cancel Invitation", () => expect(ability.cannot("cancel", "Invitation")).toBe(true));
});

// ── VIEWER ─────────────────────────────────────────────────────────────────────

describe("VIEWER", () => {
  const ability = createAbility("VIEWER");

  it("can read Tenant", () => expect(ability.can("read", "Tenant")).toBe(true));
  it("cannot update Tenant", () => expect(ability.cannot("update", "Tenant")).toBe(true));
  it("cannot read Member", () => expect(ability.cannot("read", "Member")).toBe(true));
  it("cannot invite Member", () => expect(ability.cannot("invite", "Member")).toBe(true));
  it("cannot remove Member", () => expect(ability.cannot("remove", "Member")).toBe(true));
  it("cannot read Invitation", () => expect(ability.cannot("read", "Invitation")).toBe(true));
  it("cannot cancel Invitation", () => expect(ability.cannot("cancel", "Invitation")).toBe(true));
});
