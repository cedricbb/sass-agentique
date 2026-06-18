import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  upsertBusinessProfile: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { upsertBusinessProfileAction } from "../business-profile";
import { upsertBusinessProfile } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedUpsertBusinessProfile = vi.mocked(upsertBusinessProfile);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const fakeAdmin = {
  id: "admin-user-id",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const mockProfile = {
  id: "profile-1",
  ownerId: "admin-user-id",
  name: "ACME Corp",
  legalForm: null,
  siret: null,
  tvaIntra: null,
  address: null,
  email: null,
  phone: null,
  iban: null,
  bic: null,
  logoKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validInput = { name: "ACME Corp" };

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  mockedUpsertBusinessProfile.mockResolvedValue(mockProfile as never);
});

describe("upsertBusinessProfileAction", () => {
  it("calls_upsert_service_with_user_id", async () => {
    await upsertBusinessProfileAction(validInput);
    expect(mockedUpsertBusinessProfile.mock.calls[0][0]).toBe("admin-user-id");
  });

  it("returns_ok_on_valid_input", async () => {
    const result = await upsertBusinessProfileAction(validInput);
    expect(result).toEqual({ ok: true, data: mockProfile });
  });

  it("returns_validation_error_on_invalid_input", async () => {
    const result = await upsertBusinessProfileAction({});
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
  });

  it("normalizes_empty_strings_to_undefined", async () => {
    await upsertBusinessProfileAction({
      name: "X",
      siret: "",
      email: "",
      iban: "",
      bic: "",
    });
    const mappedInput = mockedUpsertBusinessProfile.mock.calls[0][1];
    expect(mappedInput.siret).toBeUndefined();
    expect(mappedInput.email).toBeUndefined();
    expect(mappedInput.iban).toBeUndefined();
    expect(mappedInput.bic).toBeUndefined();
  });

  it("revalidates_business_profile_path", async () => {
    await upsertBusinessProfileAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/settings/business-profile");
  });
});
