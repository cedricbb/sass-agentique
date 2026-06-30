import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
    "insert", "values", "returning",
    "update", "set", "delete",
    "innerJoin", "orderBy",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  clients: { ownerId: "ownerId_col", archivedAt: "archivedAt_col" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNull: vi.fn((col: unknown) => ({ op: "isNull", col })),
}));

import { ownerScope } from "../owner-scope";
import { listClientsByOwner } from "../client.service";
import { eq, and, isNull } from "drizzle-orm";

const CLIENT_A_FIXTURE = { id: "c-a1", name: "Acme Studio", ownerId: "owner-a-id", archivedAt: null };
const CLIENT_B_FIXTURE = { id: "c-b1", name: "OwnerB-Isolated-Corp", ownerId: "owner-b-id", archivedAt: null };
const CLIENT_A_ARCHIVED = { id: "c-a2", name: "Archived Corp", ownerId: "owner-a-id", archivedAt: new Date() };

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("ownerScope", () => {
  it("owner_scope_produces_eq_clause", () => {
    const fakeTable = { ownerId: "some_col" };
    const result = ownerScope(fakeTable as never, "test-uuid");
    expect(eq).toHaveBeenCalledWith("some_col", "test-uuid");
    expect(result).toMatchObject({ op: "eq" });
  });
});

describe("listClientsByOwner", () => {
  it("list_clients_by_owner_returns_only_owned_clients", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_A_FIXTURE]);
    const result = await listClientsByOwner("owner-a-id");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toHaveProperty("op", "and");
    expect(eq).toHaveBeenCalledWith("ownerId_col", "owner-a-id");
    expect(isNull).toHaveBeenCalledWith("archivedAt_col");
    expect(result).toEqual([CLIENT_A_FIXTURE]);
  });

  it("list_clients_by_owner_excludes_other_owner", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_B_FIXTURE]);
    const result = await listClientsByOwner("owner-b-id");
    expect(eq).toHaveBeenCalledWith("ownerId_col", "owner-b-id");
    expect(result).toEqual([CLIENT_B_FIXTURE]);
    expect(result.every((c) => c.ownerId === "owner-b-id")).toBe(true);
  });

  it("list_clients_by_owner_includes_archived_when_opted_in", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_A_FIXTURE, CLIENT_A_ARCHIVED]);
    const result = await listClientsByOwner("owner-a-id", { includeArchived: true });
    expect(dbMock.where).toHaveBeenCalled();
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toHaveProperty("op", "eq");
    expect(and).not.toHaveBeenCalled();
    expect(isNull).not.toHaveBeenCalled();
    expect(result).toEqual([CLIENT_A_FIXTURE, CLIENT_A_ARCHIVED]);
  });
});
