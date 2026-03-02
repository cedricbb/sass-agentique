import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "from",
    "where",
    "innerJoin",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() {
    return dbMock;
  },
  memberships: {},
  users: {},
  tenants: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  addMember,
  removeMember,
  updateMemberRole,
  getMembersByTenant,
  getUserRole,
  getMembershipByUser,
} from "../membership.service";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("membership.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  // ── addMember ─────────────────────────────────────────────────────────────

  describe("addMember", () => {
    it("lève ALREADY_MEMBER si l'utilisateur est déjà membre", async () => {
      // check existing → membership trouvé
      dbMock.where.mockResolvedValueOnce([{ id: "m1" }]);

      await expect(
        addMember({ userId: "u1", tenantId: "t1" }),
      ).rejects.toThrow("ALREADY_MEMBER");
    });

    it("crée le membership avec succès", async () => {
      dbMock.where.mockResolvedValueOnce([]); // pas de membership existant
      dbMock.returning.mockResolvedValueOnce([
        {
          id: "m1",
          userId: "u1",
          tenantId: "t1",
          role: "MEMBER",
          createdAt: new Date(),
        },
      ]);

      const result = await addMember({ userId: "u1", tenantId: "t1" });
      expect(result).toMatchObject({ id: "m1", role: "MEMBER" });
    });

    it("utilise le rôle OWNER si spécifié", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      dbMock.returning.mockResolvedValueOnce([
        {
          id: "m1",
          userId: "u1",
          tenantId: "t1",
          role: "OWNER",
          createdAt: new Date(),
        },
      ]);

      const result = await addMember({ userId: "u1", tenantId: "t1", role: "OWNER" });
      expect(result.role).toBe("OWNER");
    });
  });

  // ── removeMember ──────────────────────────────────────────────────────────

  describe("removeMember", () => {
    it("lève FORBIDDEN si le membership appartient à un autre tenant (isolation cross-tenant)", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "tenant-B", role: "MEMBER" },
      ]);

      await expect(
        removeMember("m1", "tenant-A"),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("lève FORBIDDEN si le membership n'existe pas", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      await expect(
        removeMember("m-unknown", "t1"),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("lève CANNOT_REMOVE_OWNER si le membre est OWNER", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "t1", role: "OWNER" },
      ]);

      await expect(
        removeMember("m1", "t1"),
      ).rejects.toThrow("CANNOT_REMOVE_OWNER");
    });

    it("supprime le membre avec succès", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "t1", role: "MEMBER" },
      ]);
      dbMock.where.mockResolvedValueOnce(undefined); // delete

      await expect(removeMember("m1", "t1")).resolves.toBeUndefined();
      expect(dbMock.delete).toHaveBeenCalled();
    });
  });

  // ── updateMemberRole ──────────────────────────────────────────────────────

  describe("updateMemberRole", () => {
    it("lève FORBIDDEN si isolation cross-tenant", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "tenant-B", role: "MEMBER" },
      ]);

      await expect(
        updateMemberRole({ membershipId: "m1", tenantId: "tenant-A", role: "ADMIN" }),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("lève CANNOT_CHANGE_OWNER_ROLE si le membre actuel est OWNER", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "t1", role: "OWNER" },
      ]);

      await expect(
        updateMemberRole({ membershipId: "m1", tenantId: "t1", role: "ADMIN" }),
      ).rejects.toThrow("CANNOT_CHANGE_OWNER_ROLE");
    });

    it("met à jour le rôle avec succès", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "m1", tenantId: "t1", role: "MEMBER" },
      ]);
      dbMock.returning.mockResolvedValueOnce([
        { id: "m1", userId: "u1", tenantId: "t1", role: "ADMIN", createdAt: new Date() },
      ]);

      const result = await updateMemberRole({
        membershipId: "m1",
        tenantId: "t1",
        role: "ADMIN",
      });
      expect(result.role).toBe("ADMIN");
    });
  });

  // ── getUserRole ───────────────────────────────────────────────────────────

  describe("getUserRole", () => {
    it("retourne null si l'utilisateur n'est pas membre", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      expect(await getUserRole("u1", "t1")).toBeNull();
    });

    it("retourne le bon rôle si membre", async () => {
      dbMock.where.mockResolvedValueOnce([{ role: "ADMIN" }]);
      expect(await getUserRole("u1", "t1")).toBe("ADMIN");
    });

    it("isolation: getUserRole tenant A ne retourne pas le rôle du tenant B", async () => {
      // Premier appel: tenant A → null
      dbMock.where.mockResolvedValueOnce([]);
      const roleA = await getUserRole("u1", "tenant-A");
      expect(roleA).toBeNull();

      // Deuxième appel: tenant B → MEMBER
      dbMock.where.mockResolvedValueOnce([{ role: "MEMBER" }]);
      const roleB = await getUserRole("u1", "tenant-B");
      expect(roleB).toBe("MEMBER");

      // Les appels sont indépendants
      expect(roleA).not.toBe(roleB);
    });
  });

  // ── getMembershipByUser ───────────────────────────────────────────────────

  describe("getMembershipByUser", () => {
    it("retourne null si pas de membership", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      expect(await getMembershipByUser("u1", "t1")).toBeNull();
    });

    it("retourne le membership trouvé", async () => {
      const m = { id: "m1", userId: "u1", tenantId: "t1", role: "OWNER", createdAt: new Date() };
      dbMock.where.mockResolvedValueOnce([m]);
      expect(await getMembershipByUser("u1", "t1")).toMatchObject(m);
    });
  });

  // ── getMembersByTenant ────────────────────────────────────────────────────

  describe("getMembersByTenant", () => {
    it("retourne les membres avec leurs infos user", async () => {
      const mockMembers = [
        { id: "m1", userId: "u1", tenantId: "t1", role: "OWNER", createdAt: new Date(), email: "owner@test.com", name: "Owner" },
        { id: "m2", userId: "u2", tenantId: "t1", role: "MEMBER", createdAt: new Date(), email: "member@test.com", name: null },
      ];
      dbMock.where.mockResolvedValueOnce(mockMembers);

      const result = await getMembersByTenant("t1");
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("email");
    });
  });
});
