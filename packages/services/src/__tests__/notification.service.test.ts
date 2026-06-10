import { describe, it, expect, vi, beforeEach } from "vitest";
import { isNotNull } from "drizzle-orm";

const mockWhere = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNotNull: vi.fn((col: unknown) => ({ op: "isNotNull", col })),
}));

vi.mock("@saas/db", () => ({
  get db() {
    return { select: mockSelect };
  },
  clientContacts: {
    id: "id",
    name: "name",
    email: "email",
    userId: "userId",
    clientId: "clientId",
  },
}));

vi.mock("@saas/config", () => ({
  env: { RESEND_API_KEY: "test-resend-key" },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ _tag: "resend-instance" })),
}));

import { dispatchNotification, getNotifiableContacts } from "../notification.service";

describe("resend_singleton", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns same Resend instance", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: "test-key" } }));
    vi.doMock("resend", () => ({
      Resend: vi.fn().mockImplementation(() => ({ _tag: "resend" })),
    }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      clientContacts: {},
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      and: vi.fn(),
      isNotNull: vi.fn(),
    }));
    const { getResendClient } = await import("../resend.client");
    expect(getResendClient()).toBe(getResendClient());
  });

  it("throws without RESEND_API_KEY", async () => {
    vi.doMock("@saas/config", () => ({ env: { RESEND_API_KEY: undefined } }));
    vi.doMock("resend", () => ({ Resend: vi.fn() }));
    vi.doMock("@saas/db", () => ({
      db: { select: vi.fn() },
      clientContacts: {},
    }));
    vi.doMock("drizzle-orm", () => ({
      eq: vi.fn(),
      and: vi.fn(),
      isNotNull: vi.fn(),
    }));
    const { getResendClient } = await import("../resend.client");
    expect(() => getResendClient()).toThrow();
  });
});

describe("dispatch", () => {
  it("resolves when handler is null", async () => {
    const payload = { clientId: "c1", entityId: "e1", tenantId: "t1" };
    await expect(
      dispatchNotification("quote.sent", payload),
    ).resolves.toBeUndefined();
  });
});

describe("get_notifiable_contacts", () => {
  beforeEach(() => {
    mockWhere.mockReset();
    mockFrom.mockReset().mockReturnValue({ where: mockWhere });
    mockSelect.mockReset().mockReturnValue({ from: mockFrom });
  });

  it("filters contacts with null userId", async () => {
    const contacts = [
      { id: "contact-1", name: "Alice", email: "alice@example.com", userId: "user-1" },
    ];
    mockWhere.mockResolvedValue(contacts);
    const result = await getNotifiableContacts("client-1");
    expect(result).toEqual(contacts);
    expect(isNotNull).toHaveBeenCalled();
  });

  it("returns empty array for no matches", async () => {
    mockWhere.mockResolvedValue([]);
    const result = await getNotifiableContacts("client-no-contacts");
    expect(result).toHaveLength(0);
  });
});
