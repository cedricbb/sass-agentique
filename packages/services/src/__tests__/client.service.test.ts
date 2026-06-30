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
  inArray: vi.fn((col: unknown, vals: unknown) => ({ op: "inArray", col, vals })),
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
  listClientContactsByOwner,
  addClientContact,
  removeClientContact,
  deleteClientContact,
  setPrimaryContact,
  getClientsForUser,
  getPrimaryClientForUser,
  getClientContactById,
  getClientNamesByIds,
} from "../client.service";
import { generateSlug } from "../utils/slug";
import { resolveBillingParty } from "../billing-party.shared";

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
    dbMock.orderBy.mockResolvedValueOnce([CONTACT_FIXTURE]);
    const result = await listClientContacts("c1");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([CONTACT_FIXTURE]);
  });

  it("list_client_contacts_ordered_by_primary_then_name", async () => {
    const ZOE = { ...CONTACT_FIXTURE, id: "z", name: "Zoe", isPrimary: true };
    const ALICE = { ...CONTACT_FIXTURE, id: "a", name: "Alice", isPrimary: false };
    const BOB = { ...CONTACT_FIXTURE, id: "b", name: "Bob", isPrimary: false };
    dbMock.orderBy.mockResolvedValueOnce([ZOE, ALICE, BOB]);
    const result = await listClientContacts("c1");
    expect(dbMock.orderBy).toHaveBeenCalled();
    const orderArgs = dbMock.orderBy.mock.calls[0];
    expect(orderArgs[0]).toMatchObject({ op: "desc" });
    expect(orderArgs[1]).toMatchObject({ op: "asc" });
    expect(result).toEqual([ZOE, ALICE, BOB]);
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

describe("deleteClientContact", () => {
  it("delete_client_contact_by_id", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    await deleteClientContact("cc1");
    expect(dbMock.delete).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toHaveProperty("op", "eq");
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
  it("resets_all_contacts_then_sets_target", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    dbMock.returning.mockResolvedValueOnce([{ ...CONTACT_FIXTURE, isPrimary: true }]);
    const result = await setPrimaryContact("c1", "cc1");
    expect(dbMock.transaction).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalledTimes(2);
    const firstSet = dbMock.set.mock.calls[0][0];
    expect(firstSet.isPrimary).toBe(false);
    const secondSet = dbMock.set.mock.calls[1][0];
    expect(secondSet.isPrimary).toBe(true);
    expect(result).toEqual({ ...CONTACT_FIXTURE, isPrimary: true });
  });

  it("returns_null_when_contact_not_found_for_client", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    dbMock.returning.mockResolvedValueOnce([]);
    const result = await setPrimaryContact("c1", "inexistant");
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

describe("persist_structured_billingAddress_on_create", () => {
  it("persist_structured_billingAddress_on_create", async () => {
    const billingAddress = { line1: "10 rue Test", city: "Paris", zip: "75001", country: "France" };
    dbMock.returning.mockResolvedValueOnce([{ ...CLIENT_FIXTURE, billingAddress }]);
    await createClient({ name: "X", slug: "x", billingAddress } as never);
    const valuesArg = dbMock.values.mock.calls[0][0];
    expect(valuesArg.billingAddress).toEqual(billingAddress);
  });
});

describe("persist_structured_billingAddress_on_update", () => {
  it("persist_structured_billingAddress_on_update", async () => {
    const billingAddress = { line1: "99 av. Test", city: "Lyon", zip: "69000", country: "France" };
    dbMock.returning.mockResolvedValueOnce([{ ...CLIENT_FIXTURE, billingAddress }]);
    await updateClient("c1", { billingAddress } as never);
    const setArg = dbMock.set.mock.calls[0][0];
    expect(setArg.billingAddress).toEqual(billingAddress);
  });
});

describe("round_trip_billingAddress_through_resolveBillingParty", () => {
  it("round_trip_billingAddress_through_resolveBillingParty", async () => {
    const billingAddress = { line1: "10 rue Test", city: "Paris", zip: "75001", country: "France" };
    dbMock.returning.mockResolvedValueOnce([{ ...CLIENT_FIXTURE, billingAddress }]);
    const client = await createClient({ name: "Acme", slug: "acme" } as never);
    const billTo = resolveBillingParty({
      name: client.name,
      type: "company",
      email: null,
      phone: null,
      billingAddress: client.billingAddress,
    });
    expect(billTo.address).toEqual(billingAddress);
    expect(billTo.address.line1).toBe("10 rue Test");
    expect(billTo.address.city).toBe("Paris");
  });
});

describe("listClientContactsByOwner", () => {
  it("list_client_contacts_by_owner_returns_filtered_contacts", async () => {
    const CONTACT_C1 = { ...CONTACT_FIXTURE, id: "cc-c1", clientId: "c-1", isPrimary: true, name: "Alice" };
    const CONTACT_C2 = { ...CONTACT_FIXTURE, id: "cc-c2", clientId: "c-2", isPrimary: false, name: "Bob" };
    dbMock.orderBy.mockResolvedValueOnce([
      { clientContacts: CONTACT_C1 },
      { clientContacts: CONTACT_C2 },
    ]);
    const result = await listClientContactsByOwner("owner-1");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.innerJoin).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.orderBy).toHaveBeenCalled();
    const orderArgs = dbMock.orderBy.mock.calls[0];
    expect(orderArgs[1]).toMatchObject({ op: "desc" });
    expect(orderArgs[2]).toMatchObject({ op: "asc" });
    expect(result).toEqual([CONTACT_C1, CONTACT_C2]);
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

describe("getClientNamesByIds", () => {
  it("get_client_names_by_ids_returns_empty_record_for_empty_ids", async () => {
    const result = await getClientNamesByIds([]);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("get_client_names_by_ids_returns_active_client_with_archived_false", async () => {
    dbMock.where.mockResolvedValueOnce([{ id: "c1", name: "Acme", archivedAt: null }]);
    const result = await getClientNamesByIds(["c1"]);
    expect(result).toEqual({ c1: { name: "Acme", archived: false } });
  });

  it("get_client_names_by_ids_returns_archived_client_with_archived_true", async () => {
    dbMock.where.mockResolvedValueOnce([{ id: "c1", name: "Archived Corp", archivedAt: new Date() }]);
    const result = await getClientNamesByIds(["c1"]);
    expect(result).toEqual({ c1: { name: "Archived Corp", archived: true } });
  });

  it("get_client_names_by_ids_archived_suffix_applied", async () => {
    dbMock.where.mockResolvedValueOnce([
      { id: "c1", name: "Active Corp", archivedAt: null },
      { id: "c2", name: "Archived Corp", archivedAt: new Date() },
    ]);
    const lookup = await getClientNamesByIds(["c1", "c2"]);
    const clientNames: Record<string, string> = Object.fromEntries(
      Object.entries(lookup).map(([id, { name, archived }]) => [
        id,
        archived ? `${name} (archivé)` : name,
      ]),
    );
    expect(clientNames["c1"]).toBe("Active Corp");
    expect(clientNames["c2"]).toBe("Archived Corp (archivé)");
  });

  it("list_clients_excludes_archived_by_default", async () => {
    dbMock.where.mockResolvedValueOnce([CLIENT_FIXTURE]);
    const result = await listClients();
    const whereArg = dbMock.where.mock.calls[0][0];
    expect(whereArg).toHaveProperty("op", "isNull");
    expect(result).toEqual([CLIENT_FIXTURE]);
  });
});

describe("getClientContactById", () => {
  it("returns_contact_without_portal_account", async () => {
    const contactWithoutPortal = { id: "cc-no-portal", clientId: "c1", name: "Jeanne Manuell", email: null, phone: null, role: null, isPrimary: false, userId: null, createdAt: new Date(), updatedAt: new Date() };
    dbMock.limit.mockResolvedValueOnce([contactWithoutPortal]);

    const result = await getClientContactById("cc-no-portal");

    expect(result).toEqual(contactWithoutPortal);
    expect(result?.userId).toBeNull();
  });

  it("returns null when contact not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);

    const result = await getClientContactById("unknown-id");

    expect(result).toBeNull();
  });
});

