import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  createClient: vi.fn(),
  updateClient: vi.fn(),
  archiveClient: vi.fn(),
  getClientById: vi.fn(),
  listClientContacts: vi.fn(),
  addClientContact: vi.fn(),
  createInvitation: vi.fn(),
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
  inviteCustomerAction,
  addClientContactAction,
} from "../clients";
import {
  createClient,
  updateClient,
  archiveClient,
  getClientById,
  listClientContacts,
  addClientContact,
  createInvitation,
} from "@saas/services";
import { inviteCustomerSchema } from "@/lib/schemas/client.schemas";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateClient = vi.mocked(createClient);
const mockedUpdateClient = vi.mocked(updateClient);
const mockedArchiveClient = vi.mocked(archiveClient);
const mockedGetClientById = vi.mocked(getClientById);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedListClientContacts = vi.mocked(listClientContacts);
const mockedAddClientContact = vi.mocked(addClientContact);
const mockedCreateInvitation = vi.mocked(createInvitation);

const VALID_CLIENT_ID = "123e4567-e89b-12d3-a456-426614174001";
const VALID_CONTACT_ID = "123e4567-e89b-12d3-a456-426614174002";

const fakeContact = {
  id: VALID_CONTACT_ID,
  clientId: VALID_CLIENT_ID,
  email: "contact@example.com",
  name: "Alice",
  userId: "u2",
  isPrimary: false,
  role: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeAdmin = { id: "u1", role: "admin" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakeClient = {
  id: "c1",
  name: "Acme",
  email: "a@b.com",
  phone: null,
  address: null,
  slug: "acme",
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

describe("createClientAction", () => {
  const validInput = { name: "Acme", slug: "acme", email: "a@b.com" };

  it("1 — happy path", async () => {
    mockedCreateClient.mockResolvedValue(fakeClient as never);
    const result = await createClientAction(validInput);
    expect(result).toEqual({ ok: true, data: fakeClient });
    expect(mockedCreateClient).toHaveBeenCalledWith({ ...validInput, type: "company", ownerId: "u1" });
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
    mockedArchiveClient.mockResolvedValue(undefined as never);
    const result = await deleteClientAction("c1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(mockedArchiveClient).toHaveBeenCalledWith("c1");
  });

  it("14 — service throw", async () => {
    mockedArchiveClient.mockRejectedValue(new Error("db down"));
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
    mockedArchiveClient.mockResolvedValue(undefined as never);
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

describe("inviteCustomerAction", () => {
  const fakeExpiresAt = new Date("2026-06-02T10:00:00Z");

  it("inviteCustomerAction — success with valid contact", async () => {
    mockedListClientContacts.mockResolvedValue([fakeContact] as never);
    mockedCreateInvitation.mockResolvedValue({ id: "inv-1", token: "tok", expiresAt: fakeExpiresAt } as never);

    const result = await inviteCustomerAction(VALID_CLIENT_ID, VALID_CONTACT_ID);

    expect(result).toEqual({ ok: true, data: { expiresAt: fakeExpiresAt } });
    expect(mockedCreateInvitation).toHaveBeenCalledWith({
      clientId: VALID_CLIENT_ID,
      contactId: VALID_CONTACT_ID,
      email: "contact@example.com",
      invitedBy: "u1",
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/clients/${VALID_CLIENT_ID}`);
  });

  it("inviteCustomerAction — rejects contact not owned by client", async () => {
    mockedListClientContacts.mockResolvedValue([] as never);

    const result = await inviteCustomerAction(VALID_CLIENT_ID, VALID_CONTACT_ID);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
    expect(mockedCreateInvitation).not.toHaveBeenCalled();
  });

  it("inviteCustomerAction — rejects unauthenticated caller", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());

    await expect(inviteCustomerAction(VALID_CLIENT_ID, VALID_CONTACT_ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockedCreateInvitation).not.toHaveBeenCalled();
  });

  it("inviteCustomerAction — rejects invalid uuid input", async () => {
    const result = await inviteCustomerAction("not-uuid", "also-not-uuid");

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(mockedListClientContacts).not.toHaveBeenCalled();
    expect(mockedCreateInvitation).not.toHaveBeenCalled();
  });
});

describe("inviteCustomerSchema", () => {
  it("inviteCustomerSchema — accepts valid uuid pair", () => {
    const result = inviteCustomerSchema.safeParse({
      clientId: VALID_CLIENT_ID,
      contactId: VALID_CONTACT_ID,
    });
    expect(result.success).toBe(true);
  });

  it("inviteCustomerSchema — rejects non-uuid input", () => {
    const result = inviteCustomerSchema.safeParse({
      clientId: "not-uuid",
      contactId: VALID_CONTACT_ID,
    });
    expect(result.success).toBe(false);
  });
});

describe("addClientContactAction", () => {
  const validInput = {
    clientId: VALID_CLIENT_ID,
    name: "Alice",
    email: "alice@example.com",
    role: "Décideur",
    isPrimary: false,
  };

  const createdContact = {
    ...fakeContact,
    email: "alice@example.com",
    name: "Alice",
    userId: null,
  };

  it("addClientContactAction — success creates contact with userId null", async () => {
    mockedGetClientById.mockResolvedValue(fakeClient as never);
    mockedListClientContacts.mockResolvedValue([]);
    mockedAddClientContact.mockResolvedValue(createdContact as never);

    const result = await addClientContactAction(validInput);

    expect(result).toEqual({ ok: true, data: createdContact });
    expect(mockedAddClientContact).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, name: "Alice", email: "alice@example.com" }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/admin/clients/${VALID_CLIENT_ID}`);
  });

  it("addClientContactAction — rejects unknown client", async () => {
    mockedGetClientById.mockResolvedValue(null);

    const result = await addClientContactAction(validInput);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "CLIENT_NOT_FOUND" }),
    });
    expect(mockedAddClientContact).not.toHaveBeenCalled();
  });

  it("addClientContactAction — rejects duplicate email case-insensitive", async () => {
    mockedGetClientById.mockResolvedValue(fakeClient as never);
    mockedListClientContacts.mockResolvedValue([{ ...fakeContact, email: "ALICE@example.com" }] as never);

    const result = await addClientContactAction(validInput);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "EMAIL_ALREADY_EXISTS" }),
    });
    expect(mockedAddClientContact).not.toHaveBeenCalled();
  });

  it("addClientContactAction — rejects unauthenticated caller", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());

    await expect(addClientContactAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });

  it("addClientContactAction — rejects invalid input", async () => {
    const result = await addClientContactAction({ clientId: "not-uuid", name: "", email: "bad" });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
    });
    expect(mockedGetClientById).not.toHaveBeenCalled();
  });
});
