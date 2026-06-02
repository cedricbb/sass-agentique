import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "innerJoin", "orderBy",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.transaction = vi.fn().mockImplementation(async (fn: (tx: typeof chain) => Promise<unknown>) => {
    return fn(chain);
  });
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  clients: {},
  clientContacts: {},
  maintenanceContracts: { clientId: "clientId" },
}));

vi.mock("../utils/slug", () => ({
  generateSlug: vi.fn(() => "generated-slug"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  isNull: vi.fn((col: unknown) => ({ op: "isNull", col })),
  asc: vi.fn((col: unknown) => ({ op: "asc", col })),
  desc: vi.fn((col: unknown) => ({ op: "desc", col })),
}));

import {
  listClients,
  getClientById,
  getClientBySlug,
  createClient,
  updateClient,
  archiveClient,
  unarchiveClient,
  deleteClient,
  listClientContacts,
  addClientContact,
  removeClientContact,
  setPrimaryContact,
  getClientsForUser,
  getPrimaryClientForUser,
} from "../client.service";
import { generateSlug } from "../utils/slug";

const CLIENT_FIXTURE = { id: "c1", name: "Acme", slug: "acme", archivedAt: null };
const CONTACT_FIXTURE = { id: "cc1", clientId: "c1", userId: "u1", name: "Test User", email: "test@example.com", isPrimary: false, role: null };

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("listClients", () => {
  it("excludes archived by default", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await listClients();
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toHaveProperty("op", "isNull");
    expect(result).toEqual([CLIENT_FIXTURE]);
  });

  it("returns all when includeArchived is true", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await listClients({ includeArchived: true });
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toBeUndefined();
    expect(result).toEqual([CLIENT_FIXTURE]);
  });
});

describe("getClientById", () => {
  it("returns client when found", async () => {
    dbMock.limit.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await getClientById("c1");
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(CLIENT_FIXTURE);
  });

  it("returns null when not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await getClientById("missing");
    expect(result).toBeNull();
  });
});

describe("getClientBySlug", () => {
  it("returns client when found", async () => {
    dbMock.limit.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await getClientBySlug("acme");
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(CLIENT_FIXTURE);
  });
});

describe("createClient", () => {
  it("uses generateSlug when slug not provided", async () => {
    dbMock.returning.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await createClient({ name: "Acme" } as any);
    expect(generateSlug).toHaveBeenCalledWith("Acme");
    const valuesArg = dbMock.values.mock.calls[0][0];
    expect(valuesArg.slug).toBe("generated-slug");
    expect(result).toEqual(CLIENT_FIXTURE);
  });

  it("uses provided slug when given", async () => {
    dbMock.returning.mockResolvedValueOnce([CLIENT_FIXTURE]);
    await createClient({ name: "Acme", slug: "custom-slug" } as any);
    expect(generateSlug).not.toHaveBeenCalled();
    const valuesArg = dbMock.values.mock.calls[0][0];
    expect(valuesArg.slug).toBe("custom-slug");
  });
});

describe("updateClient", () => {
  it("returns updated client with updatedAt", async () => {
    dbMock.returning.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await updateClient("c1", { name: "Acme2" });
    const setArg = dbMock.set.mock.calls[0][0];
    expect(setArg.updatedAt).toBeInstanceOf(Date);
    expect(setArg.name).toBe("Acme2");
    expect(result).toEqual(CLIENT_FIXTURE);
  });

  it("returns null when not found", async () => {
    dbMock.returning.mockResolvedValueOnce([]);
    const result = await updateClient("missing", { name: "X" });
    expect(result).toBeNull();
  });
});

describe("archiveClient", () => {
  it("sets archivedAt to a Date", async () => {
    dbMock.returning.mockResolvedValueOnce([{ ...CLIENT_FIXTURE, archivedAt: new Date() }]);
    await archiveClient("c1");
    const setArg = dbMock.set.mock.calls[0][0];
    expect(setArg.archivedAt).toBeInstanceOf(Date);
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });
});

describe("unarchiveClient", () => {
  it("sets archivedAt to null", async () => {
    dbMock.returning.mockResolvedValueOnce([CLIENT_FIXTURE]);
    await unarchiveClient("c1");
    const setArg = dbMock.set.mock.calls[0][0];
    expect(setArg.archivedAt).toBeNull();
    expect(setArg.updatedAt).toBeInstanceOf(Date);
  });
});

describe("deleteClient", () => {
  it("deletes contracts then client in a transaction", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    dbMock.where.mockResolvedValueOnce(undefined);
    await deleteClient("c1");
    expect(dbMock.transaction).toHaveBeenCalled();
    expect(dbMock.delete).toHaveBeenCalledTimes(2);
  });
});

describe("listClientContacts", () => {
  it("returns contacts for clientId", async () => {
    dbMock.where.mockResolvedValueOnce([CONTACT_FIXTURE]);
    const result = await listClientContacts("c1");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([CONTACT_FIXTURE]);
  });
});

describe("addClientContact", () => {
  it("inserts_without_userId_defaults_to_null", async () => {
    dbMock.returning.mockResolvedValueOnce([{ ...CONTACT_FIXTURE, userId: null }]);
    const result = await addClientContact({ clientId: "c1", name: "Test User", email: "test@example.com" });
    const valuesArg = dbMock.values.mock.calls[0][0];
    expect(valuesArg.clientId).toBe("c1");
    expect(valuesArg.name).toBe("Test User");
    expect(valuesArg.email).toBe("test@example.com");
    expect(valuesArg.userId).toBeNull();
    expect(valuesArg.isPrimary).toBe(false);
    expect(result).toEqual({ ...CONTACT_FIXTURE, userId: null });
  });

  it("inserts_with_userId_linked", async () => {
    dbMock.returning.mockResolvedValueOnce([CONTACT_FIXTURE]);
    const result = await addClientContact({ clientId: "c1", name: "Test User", email: "test@example.com", userId: "u1" });
    const valuesArg = dbMock.values.mock.calls[0][0];
    expect(valuesArg.clientId).toBe("c1");
    expect(valuesArg.name).toBe("Test User");
    expect(valuesArg.email).toBe("test@example.com");
    expect(valuesArg.userId).toBe("u1");
    expect(result).toEqual(CONTACT_FIXTURE);
  });
});

describe("removeClientContact", () => {
  it("deletes with and(eq(clientId), eq(userId))", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    await removeClientContact("c1", "u1");
    expect(dbMock.delete).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
  });
});

describe("setPrimaryContact", () => {
  it("uses transaction to reset then set", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    dbMock.returning.mockResolvedValueOnce([{ ...CONTACT_FIXTURE, isPrimary: true }]);
    const result = await setPrimaryContact("c1", "u1");
    expect(dbMock.transaction).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledTimes(2);
    const firstSet = dbMock.set.mock.calls[0][0];
    expect(firstSet.isPrimary).toBe(false);
    const secondSet = dbMock.set.mock.calls[1][0];
    expect(secondSet.isPrimary).toBe(true);
    expect(result).toEqual({ ...CONTACT_FIXTURE, isPrimary: true });
  });

  it("returns null when contact not found", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    dbMock.returning.mockResolvedValueOnce([]);
    const result = await setPrimaryContact("c1", "unknown");
    expect(result).toBeNull();
  });
});

const CLIENT_A = { id: "ca", name: "Alpha", slug: "alpha", archivedAt: null };
const CLIENT_B = { id: "cb", name: "Beta", slug: "beta", archivedAt: null };
const CONTACT_A = { id: "cca", clientId: "ca", userId: "u1", isPrimary: true };
const CONTACT_B = { id: "ccb", clientId: "cb", userId: "u1", isPrimary: false };

describe("getClientsForUser", () => {
  it("returns clients linked to user, ordered by name", async () => {
    dbMock.orderBy.mockResolvedValueOnce([
      { clients: CLIENT_A, clientContacts: CONTACT_A },
      { clients: CLIENT_B, clientContacts: CONTACT_B },
    ]);
    const result = await getClientsForUser("u1");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.innerJoin).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
    expect(result).toEqual([CLIENT_A, CLIENT_B]);
  });

  it("returns empty array when user has no links", async () => {
    dbMock.orderBy.mockResolvedValueOnce([]);
    const result = await getClientsForUser("u-no-links");
    expect(result).toEqual([]);
  });

  it("returns empty array for nonexistent user", async () => {
    dbMock.orderBy.mockResolvedValueOnce([]);
    const result = await getClientsForUser("nonexistent-uuid");
    expect(result).toEqual([]);
  });

  it("excludes archived clients", async () => {
    dbMock.orderBy.mockResolvedValueOnce([]);
    const result = await getClientsForUser("u-archived-only");
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("returns multiple clients when user has N links", async () => {
    dbMock.orderBy.mockResolvedValueOnce([
      { clients: CLIENT_A, clientContacts: CONTACT_A },
      { clients: CLIENT_B, clientContacts: CONTACT_B },
    ]);
    const result = await getClientsForUser("u1");
    expect(result).toHaveLength(2);
  });
});

describe("getPrimaryClientForUser", () => {
  it("returns null when user has no links", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await getPrimaryClientForUser("u-no-links");
    expect(result).toBeNull();
  });

  it("returns the single linked client", async () => {
    dbMock.limit.mockResolvedValueOnce([
      { clients: CLIENT_A, clientContacts: CONTACT_A },
    ]);
    const result = await getPrimaryClientForUser("u1");
    expect(result).toEqual(CLIENT_A);
  });

  it("returns isPrimary client when multiple links exist", async () => {
    dbMock.limit.mockResolvedValueOnce([
      { clients: CLIENT_A, clientContacts: { ...CONTACT_A, isPrimary: true } },
    ]);
    const result = await getPrimaryClientForUser("u1");
    expect(dbMock.orderBy).toHaveBeenCalled();
    expect(dbMock.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(CLIENT_A);
  });

  it("returns first alphabetically when no isPrimary", async () => {
    dbMock.limit.mockResolvedValueOnce([
      { clients: CLIENT_A, clientContacts: { ...CONTACT_A, isPrimary: false } },
    ]);
    const result = await getPrimaryClientForUser("u1");
    expect(result).toEqual(CLIENT_A);
  });

  it("excludes archived clients", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await getPrimaryClientForUser("u-archived");
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
