import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  createPrestation: vi.fn(),
  updatePrestation: vi.fn(),
  archivePrestation: vi.fn(),
  getPrestationById: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createPrestationAction,
  updatePrestationAction,
  archivePrestationAction,
  getPrestationByIdAction,
} from "../prestations";
import {
  createPrestation,
  updatePrestation,
  archivePrestation,
  getPrestationById,
} from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreatePrestation = vi.mocked(createPrestation);
const mockedUpdatePrestation = vi.mocked(updatePrestation);
const mockedArchivePrestation = vi.mocked(archivePrestation);
const mockedGetPrestationById = vi.mocked(getPrestationById);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const fakeAdmin = { id: "u1", role: "admin" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakePrestation = {
  id: "p1",
  name: "Dev Web",
  slug: "dev-web",
  description: null,
  basePriceEurCents: 5000,
  kind: "one_shot",
  isActive: true,
  sortOrder: 0,
  ownerId: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRedirectError() {
  const err = new Error("NEXT_REDIRECT");
  (err as unknown as { digest: string }).digest = "NEXT_REDIRECT;/login";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
});

describe("createPrestationAction", () => {
  const validInput = { name: "Dev Web", basePriceEur: 50 };

  it("1 — happy path + conversion €→cents", async () => {
    mockedCreatePrestation.mockResolvedValue(fakePrestation as never);
    const result = await createPrestationAction(validInput);
    expect(result).toEqual({ ok: true, data: fakePrestation });
    expect(mockedCreatePrestation).toHaveBeenCalledWith({
      name: "Dev Web",
      slug: undefined,
      description: undefined,
      basePriceEurCents: 5000,
      kind: "one_shot",
    });
  });

  it("2 — revalidatePath appelé", async () => {
    mockedCreatePrestation.mockResolvedValue(fakePrestation as never);
    await createPrestationAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/prestations");
  });

  it("3 — fractionnaire 49.99→4999", async () => {
    mockedCreatePrestation.mockResolvedValue(fakePrestation as never);
    await createPrestationAction({ name: "X", basePriceEur: 49.99 });
    expect(mockedCreatePrestation).toHaveBeenCalledWith(
      expect.objectContaining({ basePriceEurCents: 4999 }),
    );
  });

  it("4 — kind recurring", async () => {
    mockedCreatePrestation.mockResolvedValue(fakePrestation as never);
    await createPrestationAction({ name: "X", kind: "recurring" });
    expect(mockedCreatePrestation).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "recurring" }),
    );
  });

  it("5 — ZodError name vide→VALIDATION_ERROR", async () => {
    const result = await createPrestationAction({ name: "" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
    expect(mockedCreatePrestation).not.toHaveBeenCalled();
  });

  it("6 — DB error→INTERNAL_ERROR", async () => {
    mockedCreatePrestation.mockRejectedValue(new Error("db down"));
    const result = await createPrestationAction(validInput);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });
});

describe("updatePrestationAction", () => {
  const validPatch = { name: "NewName" };

  it("7 — happy path", async () => {
    mockedUpdatePrestation.mockResolvedValue(fakePrestation as never);
    const result = await updatePrestationAction("p1", validPatch);
    expect(result).toEqual({ ok: true, data: fakePrestation });
    expect(mockedUpdatePrestation).toHaveBeenCalledWith("p1", { name: "NewName" });
  });

  it("8 — revalidate 2x (liste+détail)", async () => {
    mockedUpdatePrestation.mockResolvedValue(fakePrestation as never);
    await updatePrestationAction("p1", validPatch);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/prestations");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/prestations/p1");
  });

  it("9 — patch partiel €→cents", async () => {
    mockedUpdatePrestation.mockResolvedValue(fakePrestation as never);
    await updatePrestationAction("p1", { basePriceEur: 29.99 });
    expect(mockedUpdatePrestation).toHaveBeenCalledWith("p1", {
      basePriceEurCents: 2999,
    });
  });

  it("10 — patch sans basePriceEur→pas de basePriceEurCents", async () => {
    mockedUpdatePrestation.mockResolvedValue(fakePrestation as never);
    await updatePrestationAction("p1", { name: "Y" });
    const callArgs = mockedUpdatePrestation.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty("basePriceEurCents");
  });

  it("11 — null→INTERNAL_ERROR", async () => {
    mockedUpdatePrestation.mockResolvedValue(null as never);
    const result = await updatePrestationAction("p1", validPatch);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });
});

describe("archivePrestationAction", () => {
  it("12 — happy path isActive=false", async () => {
    const archived = { ...fakePrestation, isActive: false };
    mockedArchivePrestation.mockResolvedValue(archived as never);
    const result = await archivePrestationAction("p1");
    expect(result).toEqual({ ok: true, data: archived });
    expect(archived.isActive).toBe(false);
  });

  it("13 — retourne Prestation (pas void)", async () => {
    const archived = { ...fakePrestation, isActive: false };
    mockedArchivePrestation.mockResolvedValue(archived as never);
    const result = await archivePrestationAction("p1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("name");
    }
  });

  it("14 — revalidatePath appelé", async () => {
    mockedArchivePrestation.mockResolvedValue({ ...fakePrestation, isActive: false } as never);
    await archivePrestationAction("p1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/prestations");
  });

  it("15 — null→INTERNAL_ERROR", async () => {
    mockedArchivePrestation.mockResolvedValue(null as never);
    const result = await archivePrestationAction("p1");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });
});

describe("getPrestationByIdAction", () => {
  it("16 — happy path", async () => {
    mockedGetPrestationById.mockResolvedValue(fakePrestation as never);
    const result = await getPrestationByIdAction("p1");
    expect(result).toEqual({ ok: true, data: fakePrestation });
    expect(mockedGetPrestationById).toHaveBeenCalledWith("p1");
  });

  it("17 — null→ok(null) pas erreur", async () => {
    mockedGetPrestationById.mockResolvedValue(null as never);
    const result = await getPrestationByIdAction("p1");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("18 — pas de revalidatePath", async () => {
    mockedGetPrestationById.mockResolvedValue(fakePrestation as never);
    await getPrestationByIdAction("p1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("transversaux", () => {
  it("19 — NEXT_REDIRECT re-throw", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createPrestationAction({ name: "X" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("20 — no unarchive/delete action exported", async () => {
    const actions = await import("../prestations");
    const exportedNames = Object.keys(actions);
    expect(exportedNames).not.toContain("unarchivePrestationAction");
    expect(exportedNames).not.toContain("deletePrestationAction");
  });
});
