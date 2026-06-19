import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
    "insert", "values", "returning", "onConflictDoUpdate",
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
  businessProfiles: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
}));

import {
  getBusinessProfile,
  upsertBusinessProfile,
  setBusinessProfileLogoKey,
} from "../business-profile.service";

const OWNER_ID = "owner-uuid-1";

const BASE_PROFILE = {
  id: "profile-uuid-1",
  ownerId: OWNER_ID,
  name: "ACME SAS",
  legalForm: "SAS",
  siret: "12345678901234",
  tvaIntra: "FR12345678901",
  address: { line1: "1 rue de la Paix", city: "Paris", zip: "75001", country: "FR" },
  email: "contact@acme.fr",
  phone: "+33123456789",
  iban: "FR7600000000000000000000000",
  bic: "BNPAFRPP",
  logoKey: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const BASE_INPUT = {
  name: "ACME SAS",
  legalForm: "SAS",
  siret: "12345678901234",
  tvaIntra: "FR12345678901",
  address: { line1: "1 rue de la Paix", city: "Paris", zip: "75001", country: "FR" },
  email: "contact@acme.fr",
  phone: "+33123456789",
  iban: "FR7600000000000000000000000",
  bic: "BNPAFRPP",
  logoKey: null,
};

describe("business-profile.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  describe("getBusinessProfile", () => {
    it("returns_null_when_no_profile_exists", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const result = await getBusinessProfile(OWNER_ID);

      expect(result).toBeNull();
      expect(dbMock.select).toHaveBeenCalled();
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
    });

    it("get_returns_profile_with_address_as_object", async () => {
      dbMock.limit.mockResolvedValueOnce([BASE_PROFILE]);

      const result = await getBusinessProfile(OWNER_ID);

      expect(result).not.toBeNull();
      expect(typeof result!.address).toBe("object");
      expect(Array.isArray(result!.address)).toBe(false);
      expect(result!.address).toMatchObject({ line1: "1 rue de la Paix", city: "Paris" });
    });
  });

  describe("upsertBusinessProfile", () => {
    it("creates_profile_on_first_upsert", async () => {
      dbMock.returning.mockResolvedValueOnce([BASE_PROFILE]);

      const result = await upsertBusinessProfile(OWNER_ID, BASE_INPUT);

      expect(result).toMatchObject({ id: BASE_PROFILE.id, name: "ACME SAS", ownerId: OWNER_ID });
      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalledWith(expect.objectContaining({ ownerId: OWNER_ID }));
      expect(dbMock.onConflictDoUpdate).toHaveBeenCalled();
      expect(dbMock.returning).toHaveBeenCalled();
    });

  it("updates_existing_profile_on_second_upsert", async () => {
      const updatedAt = new Date("2026-06-17T12:00:00Z");
      const updatedProfile = { ...BASE_PROFILE, name: "ACME SASU", legalForm: "SASU", updatedAt };
      dbMock.returning.mockResolvedValueOnce([updatedProfile]);

      const result = await upsertBusinessProfile(OWNER_ID, { ...BASE_INPUT, name: "ACME SASU", legalForm: "SASU" });

      expect(result.name).toBe("ACME SASU");
      expect(result.legalForm).toBe("SASU");
      expect(result.updatedAt).toEqual(updatedAt);
      expect(result.updatedAt.getTime()).toBeGreaterThan(BASE_PROFILE.createdAt.getTime());

      const onConflictCall = dbMock.onConflictDoUpdate.mock.calls[0][0];
      expect(onConflictCall.set).toHaveProperty("updatedAt");
      expect(onConflictCall.set).not.toHaveProperty("createdAt");
    });
  });

  describe("setBusinessProfileLogoKey", () => {
    it("set_logo_key_returns_updated_profile", async () => {
      const updatedProfile = { ...BASE_PROFILE, logoKey: "business-profiles/owner-uuid-1/logo", updatedAt: new Date() };
      dbMock.returning.mockResolvedValueOnce([updatedProfile]);

      const result = await setBusinessProfileLogoKey(OWNER_ID, "business-profiles/owner-uuid-1/logo");

      expect(result).not.toBeNull();
      expect(result!.logoKey).toBe("business-profiles/owner-uuid-1/logo");
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalledWith(expect.objectContaining({ logoKey: "business-profiles/owner-uuid-1/logo" }));
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.returning).toHaveBeenCalled();
    });

    it("set_logo_key_returns_null_when_no_profile", async () => {
      dbMock.returning.mockResolvedValueOnce([]);

      const result = await setBusinessProfileLogoKey("nonexistent-owner", "some-key");

      expect(result).toBeNull();
    });
  });
});
