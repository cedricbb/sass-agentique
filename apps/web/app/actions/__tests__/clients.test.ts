import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  deleteClient: vi.fn(),
  getClientById: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createClientAction,
  updateClientAction,
  deleteClientAction,
  getClientByIdAction,
} from "../clients";
import {
  createClient,
  updateClient,
  deleteClient,
  getClientById,
} from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateClient = vi.mocked(createClient);
const mockedUpdateClient = vi.mocked(updateClient);
const mockedDeleteClient = vi.mocked(deleteClient);
const mockedGetClientById = vi.mocked(getClientById);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const fakeAdmin = { id: "u1", role: "admin", tenantId: "t1" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakeClient = {
  id: "c1",
  name: "Acme",
  email: "a@b.com",
  phone: null,
  address: null,
  slug: "acme",
  tenantId: "t1",
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

describe("createClientAction", () => {
  const validInput = { name: "Acme", email: "a@b.com" };

  it("1 — happy path", async () => {
    mockedCreateClient.mockResolvedValue(fakeClient as never);
    const result = await createClientAction(validInput);
    expect(result).toEqual({ ok: true, data: fakeClient });
    expect(mockedCreateClient).toHaveBeenCalledWith(validInput);
  });

  it("2 — input invalide (name manquant)", async () => {
    const result = await createClientAction({});
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("3 — email invalide", async () => {
    const result = await createClientAction({ name: "X", email: "bad" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("4 — service throw Error", async () => {
    mockedCreateClient.mockRejectedValue(new Error("db down"));
    const result = await createClientAction(validInput);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("5 — non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createClientAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("6 — revalidatePath appelé", async () => {
    mockedCreateClient.mockResolvedValue(fakeClient as never);
    await createClientAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/clients");
  });
});

describe("updateClientAction", () => {
  const validPatch = { name: "NewName" };

  it("7 — happy path", async () => {
    mockedUpdateClient.mockResolvedValue(fakeClient as never);
    const result = await updateClientAction("c1", validPatch);
    expect(result).toEqual({ ok: true, data: fakeClient });
    expect(mockedUpdateClient).toHaveBeenCalledWith("c1", validPatch);
  });

  it("8 — input invalide", async () => {
    const result = await updateClientAction("c1", { name: "" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("9 — client introuvable (null)", async () => {
    mockedUpdateClient.mockResolvedValue(null as never);
    const result = await updateClientAction("c1", validPatch);
    expect(result).toEqual({ ok: true, data: null });
  });

  it("10 — service throw", async () => {
    mockedUpdateClient.mockRejectedValue(new Error("db down"));
    const result = await updateClientAction("c1", validPatch);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("11 — non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(updateClientAction("c1", validPatch)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("12 — revalidatePath appelé", async () => {
    mockedUpdateClient.mockResolvedValue(fakeClient as never);
    await updateClientAction("c1", validPatch);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/clients");
  });
});

describe("deleteClientAction", () => {
  it("13 — happy path", async () => {
    mockedDeleteClient.mockResolvedValue(undefined as never);
    const result = await deleteClientAction("c1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(mockedDeleteClient).toHaveBeenCalledWith("c1");
  });

  it("14 — service throw", async () => {
    mockedDeleteClient.mockRejectedValue(new Error("db down"));
    const result = await deleteClientAction("c1");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("15 — non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(deleteClientAction("c1")).rejects.toThrow("NEXT_REDIRECT");
  });

  it("16 — revalidatePath appelé", async () => {
    mockedDeleteClient.mockResolvedValue(undefined as never);
    await deleteClientAction("c1");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/clients");
  });
});

describe("getClientByIdAction", () => {
  it("17 — happy path", async () => {
    mockedGetClientById.mockResolvedValue(fakeClient as never);
    const result = await getClientByIdAction("c1");
    expect(result).toEqual({ ok: true, data: fakeClient });
    expect(mockedGetClientById).toHaveBeenCalledWith("c1");
  });

  it("18 — introuvable", async () => {
    mockedGetClientById.mockResolvedValue(null as never);
    const result = await getClientByIdAction("c1");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("19 — service throw", async () => {
    mockedGetClientById.mockRejectedValue(new Error("db down"));
    const result = await getClientByIdAction("c1");
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("20 — non-admin", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(getClientByIdAction("c1")).rejects.toThrow("NEXT_REDIRECT");
  });

  it("21 — pas de revalidatePath", async () => {
    mockedGetClientById.mockResolvedValue(fakeClient as never);
    await getClientByIdAction("c1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
