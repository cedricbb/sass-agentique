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
  tenants: {},
  memberships: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
}));

import {
  generateSlug,
  createTenant,
  getTenantBySlug,
  getTenantById,
  listTenantsByUser,
  updateTenant,
} from "../tenant.service";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("tenant.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  // ── generateSlug ──────────────────────────────────────────────────────────

  describe("generateSlug", () => {
    it("convertit en kebab-case", () => {
      expect(generateSlug("Hello World")).toBe("hello-world");
    });

    it("extrait la partie avant @ pour les emails", () => {
      const result = generateSlug("user@example.com");
      expect(result).not.toContain("@");
      expect(result).toBe("user");
    });

    it("supprime les caractères spéciaux", () => {
      const result = generateSlug("Test!@#$%^&*()Corp");
      expect(result).not.toMatch(/[!@#$%^&*()]/);
    });

    it("tronque à 50 caractères maximum", () => {
      const long = "a".repeat(100);
      const result = generateSlug(long);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it("gère les tirets multiples", () => {
      const result = generateSlug("Hello   World   Test");
      expect(result).not.toContain("--");
    });
  });

  // ── createTenant ──────────────────────────────────────────────────────────

  describe("createTenant", () => {
    it("lève SLUG_ALREADY_EXISTS si le slug est déjà pris", async () => {
      dbMock.where.mockResolvedValueOnce([{ id: "existing-id" }]);

      await expect(
        createTenant({ name: "My Tenant", slug: "my-tenant" }),
      ).rejects.toThrow("SLUG_ALREADY_EXISTS");
    });

    it("crée le tenant avec succès", async () => {
      dbMock.where.mockResolvedValueOnce([]); // slug check
      dbMock.returning.mockResolvedValueOnce([
        {
          id: "t1",
          slug: "my-tenant",
          name: "My Tenant",
          plan: "free",
          createdAt: new Date(),
        },
      ]);

      const result = await createTenant({
        name: "My Tenant",
        slug: "my-tenant",
      });

      expect(result).toMatchObject({ id: "t1", slug: "my-tenant" });
    });
  });

  // ── getTenantBySlug ───────────────────────────────────────────────────────

  describe("getTenantBySlug", () => {
    it("retourne null si le tenant n'existe pas", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      const result = await getTenantBySlug("unknown-tenant");
      expect(result).toBeNull();
    });

    it("retourne le tenant si trouvé", async () => {
      const mockTenant = {
        id: "t1",
        slug: "my-tenant",
        name: "My Tenant",
        plan: "free",
        createdAt: new Date(),
      };
      dbMock.where.mockResolvedValueOnce([mockTenant]);

      const result = await getTenantBySlug("my-tenant");
      expect(result).toMatchObject(mockTenant);
    });
  });

  // ── getTenantById ─────────────────────────────────────────────────────────

  describe("getTenantById", () => {
    it("retourne null si non trouvé", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      expect(await getTenantById("unknown")).toBeNull();
    });

    it("retourne le tenant si trouvé", async () => {
      const t = { id: "t1", slug: "test", name: "Test", plan: "free", createdAt: new Date() };
      dbMock.where.mockResolvedValueOnce([t]);
      expect(await getTenantById("t1")).toMatchObject(t);
    });
  });

  // ── listTenantsByUser ─────────────────────────────────────────────────────

  describe("listTenantsByUser", () => {
    it("retourne les tenants de l'utilisateur", async () => {
      const mockTenants = [
        { id: "t1", slug: "tenant-1", name: "Tenant 1", plan: "free", createdAt: new Date() },
        { id: "t2", slug: "tenant-2", name: "Tenant 2", plan: "pro", createdAt: new Date() },
      ];
      dbMock.where.mockResolvedValueOnce(mockTenants);

      const result = await listTenantsByUser("u1");
      expect(result).toHaveLength(2);
    });

    it("retourne un tableau vide si l'utilisateur n'a pas de tenant", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      const result = await listTenantsByUser("u-no-tenant");
      expect(result).toHaveLength(0);
    });
  });

  // ── updateTenant ──────────────────────────────────────────────────────────

  describe("updateTenant", () => {
    it("lève TENANT_NOT_FOUND si le tenant n'existe pas", async () => {
      dbMock.returning.mockResolvedValueOnce([]);

      await expect(
        updateTenant({ tenantId: "unknown", name: "New Name" }),
      ).rejects.toThrow("TENANT_NOT_FOUND");
    });

    it("met à jour le nom du tenant", async () => {
      const updated = {
        id: "t1",
        slug: "my-tenant",
        name: "New Name",
        plan: "free",
        createdAt: new Date(),
      };
      dbMock.returning.mockResolvedValueOnce([updated]);

      const result = await updateTenant({ tenantId: "t1", name: "New Name" });
      expect(result.name).toBe("New Name");
    });
  });
});
