import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "orderBy", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  prestations: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  asc: vi.fn((a: unknown) => ({ asc: a })),
}));

vi.mock("../utils/slug", () => ({
  generateSlug: vi.fn(() => "generated-slug"),
}));

import { eq, asc } from "drizzle-orm";
import { generateSlug } from "../utils/slug";
import {
  listPrestations,
  getPrestationById,
  getPrestationBySlug,
  createPrestation,
  updatePrestation,
  archivePrestation,
  unarchivePrestation,
  deletePrestation,
} from "../prestation.service";

function mockDbReturns(result: unknown) {
  dbMock.returning.mockResolvedValue(result);
  dbMock.orderBy.mockResolvedValue(result);
  dbMock.limit.mockResolvedValue(result);
  dbMock.where.mockImplementation(() => {
    return {
      returning: dbMock.returning,
      orderBy: dbMock.orderBy,
      limit: dbMock.limit,
      then: (resolve: (v: unknown) => void) => resolve(result),
    };
  });
}

const fixture = {
  id: "p-1",
  slug: "web-dev",
  name: "Web Dev",
  description: null,
  basePriceEurCents: 5000,
  kind: "one_shot" as const,
  stripeProductId: null,
  stripePriceId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("prestation.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  describe("listPrestations", () => {
    it("returns active prestations by default ordered by sortOrder", async () => {
      mockDbReturns([fixture]);
      const result = await listPrestations();
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.from).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      const whereArg = dbMock.where.mock.calls[0][0];
      expect(whereArg).toBeDefined();
      expect(dbMock.orderBy).toHaveBeenCalled();
      expect(asc).toHaveBeenCalled();
      expect(result).toEqual([fixture]);
    });

    it("returns all prestations when includeInactive is true", async () => {
      mockDbReturns([fixture]);
      const result = await listPrestations({ includeInactive: true });
      expect(dbMock.where).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([fixture]);
    });
  });

  describe("getPrestationById", () => {
    it("returns the prestation when found", async () => {
      mockDbReturns([fixture]);
      const result = await getPrestationById("p-1");
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(fixture);
    });

    it("returns null when not found", async () => {
      mockDbReturns([]);
      const result = await getPrestationById("missing");
      expect(result).toBeNull();
    });
  });

  describe("getPrestationBySlug", () => {
    it("returns the prestation when found", async () => {
      mockDbReturns([fixture]);
      const result = await getPrestationBySlug("web-dev");
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
      expect(result).toEqual(fixture);
    });

    it("returns null when not found", async () => {
      mockDbReturns([]);
      const result = await getPrestationBySlug("nope");
      expect(result).toBeNull();
    });
  });

  describe("createPrestation", () => {
    it("uses provided slug when present", async () => {
      mockDbReturns([fixture]);
      await createPrestation({ name: "Web Dev", slug: "custom-slug" } as any);
      expect(generateSlug).not.toHaveBeenCalled();
      const valuesArg = dbMock.values.mock.calls[0][0];
      expect(valuesArg.slug).toBe("custom-slug");
    });

    it("generates slug from name when slug is absent", async () => {
      mockDbReturns([{ ...fixture, slug: "generated-slug" }]);
      await createPrestation({ name: "Web Dev" } as any);
      expect(generateSlug).toHaveBeenCalledWith("Web Dev");
      const valuesArg = dbMock.values.mock.calls[0][0];
      expect(valuesArg.slug).toBe("generated-slug");
    });
  });

  describe("updatePrestation", () => {
    it("returns updated prestation with updatedAt set", async () => {
      const before = Date.now();
      mockDbReturns([{ ...fixture, name: "Updated" }]);
      const result = await updatePrestation("p-1", { name: "Updated" } as any);
      expect(dbMock.set).toHaveBeenCalled();
      const setArg = dbMock.set.mock.calls[0][0];
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result).toEqual({ ...fixture, name: "Updated" });
    });

    it("returns null when prestation does not exist", async () => {
      mockDbReturns([]);
      const result = await updatePrestation("missing", { name: "X" } as any);
      expect(result).toBeNull();
    });
  });

  describe("archivePrestation", () => {
    it("sets isActive to false", async () => {
      mockDbReturns([{ ...fixture, isActive: false }]);
      const result = await archivePrestation("p-1");
      const setArg = dbMock.set.mock.calls[0][0];
      expect(setArg.isActive).toBe(false);
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      expect(result).toEqual({ ...fixture, isActive: false });
    });
  });

  describe("unarchivePrestation", () => {
    it("sets isActive to true", async () => {
      mockDbReturns([{ ...fixture, isActive: true }]);
      const result = await unarchivePrestation("p-1");
      const setArg = dbMock.set.mock.calls[0][0];
      expect(setArg.isActive).toBe(true);
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      expect(result).toEqual(fixture);
    });
  });

  describe("deletePrestation", () => {
    it("calls db.delete with correct id", async () => {
      await deletePrestation("p-1");
      expect(dbMock.delete).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(eq).toHaveBeenCalled();
    });
  });
});
