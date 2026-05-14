import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
  transitionStatus: vi.fn(),
  getProjectById: vi.fn(),
  listClients: vi.fn(),
  InvalidProjectTransitionError: class InvalidProjectTransitionError extends Error {
    constructor(from: string, to: string) {
      super(`Invalid transition from ${from} to ${to}`);
      this.name = "InvalidProjectTransitionError";
    }
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createProjectAction,
  updateProjectAction,
  transitionStatusAction,
  getProjectByIdAction,
  listActiveClientsAction,
} from "../projects";
import {
  createProject,
  updateProject,
  transitionStatus,
  getProjectById,
  listClients,
  InvalidProjectTransitionError,
} from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateProject = vi.mocked(createProject);
const mockedUpdateProject = vi.mocked(updateProject);
const mockedTransitionStatus = vi.mocked(transitionStatus);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedListClients = vi.mocked(listClients);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const fakeAdmin = { id: "u1", role: "admin", tenantId: "t1" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakeProject = {
  id: "p1",
  name: "Project Alpha",
  slug: "project-alpha",
  description: null,
  clientId: "c1",
  status: "draft",
  tenantId: "t1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeClient = {
  id: "c1",
  name: "Client A",
  email: "a@test.com",
  tenantId: "t1",
  archivedAt: null,
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

// --- createProjectAction ---

describe("createProjectAction", () => {
  const validInput = { name: "Project Alpha", clientId: "00000000-0000-0000-0000-000000000001" };

  it("1 — happy path", async () => {
    mockedCreateProject.mockResolvedValue(fakeProject as never);
    const result = await createProjectAction(validInput);
    expect(result).toEqual({ ok: true, data: fakeProject });
    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Project Alpha", clientId: "00000000-0000-0000-0000-000000000001" }),
    );
  });

  it("2 — revalidatePath appelé", async () => {
    mockedCreateProject.mockResolvedValue(fakeProject as never);
    await createProjectAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
  });

  it("3 — zod fail name vide", async () => {
    const result = await createProjectAction({ name: "", clientId: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
    expect(mockedCreateProject).not.toHaveBeenCalled();
  });

  it("4 — zod fail clientId manquant", async () => {
    const result = await createProjectAction({ name: "X" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("5 — non-admin redirect rethrow", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createProjectAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- updateProjectAction ---

describe("updateProjectAction", () => {
  const validPatch = { name: "New Name" };

  it("6 — happy path", async () => {
    mockedUpdateProject.mockResolvedValue(fakeProject as never);
    const result = await updateProjectAction("p1", validPatch);
    expect(result).toEqual({ ok: true, data: fakeProject });
    expect(mockedUpdateProject).toHaveBeenCalledWith("p1", { name: "New Name" });
  });

  it("7 — revalidatePath appelé", async () => {
    mockedUpdateProject.mockResolvedValue(fakeProject as never);
    await updateProjectAction("p1", validPatch);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
  });

  it("8 — not found → error", async () => {
    mockedUpdateProject.mockResolvedValue(null as never);
    const result = await updateProjectAction("p1", validPatch);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("9 — status dans input → service throw", async () => {
    mockedUpdateProject.mockImplementation(() => {
      throw new Error("Cannot update status via updateProject. Use transitionStatus instead.");
    });
    const result = await updateProjectAction("p1", { name: "X" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("10 — zod fail (empty object still valid partial)", async () => {
    mockedUpdateProject.mockResolvedValue(fakeProject as never);
    const result = await updateProjectAction("p1", {});
    expect(result).toEqual({ ok: true, data: fakeProject });
  });

  it("11 — non-admin redirect rethrow", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(updateProjectAction("p1", validPatch)).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- transitionStatusAction ---

describe("transitionStatusAction", () => {
  const validInput = { id: "00000000-0000-0000-0000-000000000001", newStatus: "active" as const };

  it("12 — happy path draft→active", async () => {
    const activeProject = { ...fakeProject, status: "active" };
    mockedTransitionStatus.mockResolvedValue(activeProject as never);
    const result = await transitionStatusAction(validInput);
    expect(result).toEqual({ ok: true, data: activeProject });
    expect(mockedTransitionStatus).toHaveBeenCalledWith(validInput.id, "active");
  });

  it("13 — revalidatePath appelé", async () => {
    mockedTransitionStatus.mockResolvedValue(fakeProject as never);
    await transitionStatusAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
  });

  it("14 — InvalidProjectTransitionError → 409", async () => {
    mockedTransitionStatus.mockImplementation(() => {
      throw new InvalidProjectTransitionError("draft" as never, "delivered" as never);
    });
    const result = await transitionStatusAction({
      id: "00000000-0000-0000-0000-000000000001",
      newStatus: "delivered",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "PROJECT_INVALID_TRANSITION", status: 409 }),
    });
  });

  it("15 — not found → error", async () => {
    mockedTransitionStatus.mockResolvedValue(null as never);
    const result = await transitionStatusAction(validInput);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INTERNAL_ERROR", status: 500 }),
    });
  });

  it("16 — zod fail bad status enum", async () => {
    const result = await transitionStatusAction({
      id: "00000000-0000-0000-0000-000000000001",
      newStatus: "invalid_status",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("17 — zod fail id manquant", async () => {
    const result = await transitionStatusAction({ newStatus: "active" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "VALIDATION_ERROR", status: 400 }),
    });
  });

  it("18 — non-admin redirect rethrow", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(transitionStatusAction(validInput)).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- getProjectByIdAction ---

describe("getProjectByIdAction", () => {
  it("19 — happy path", async () => {
    mockedGetProjectById.mockResolvedValue(fakeProject as never);
    const result = await getProjectByIdAction("p1");
    expect(result).toEqual({ ok: true, data: fakeProject });
    expect(mockedGetProjectById).toHaveBeenCalledWith("p1");
  });

  it("20 — retourne null → ok(null)", async () => {
    mockedGetProjectById.mockResolvedValue(null as never);
    const result = await getProjectByIdAction("p1");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("21 — pas de revalidatePath", async () => {
    mockedGetProjectById.mockResolvedValue(fakeProject as never);
    await getProjectByIdAction("p1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("22 — non-admin redirect rethrow", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(getProjectByIdAction("p1")).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- listActiveClientsAction ---

describe("listActiveClientsAction", () => {
  it("23 — happy path retourne clients", async () => {
    mockedListClients.mockResolvedValue([fakeClient] as never);
    const result = await listActiveClientsAction();
    expect(result).toEqual({ ok: true, data: [fakeClient] });
    expect(mockedListClients).toHaveBeenCalled();
  });

  it("24 — liste vide", async () => {
    mockedListClients.mockResolvedValue([] as never);
    const result = await listActiveClientsAction();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("25 — pas de revalidatePath", async () => {
    mockedListClients.mockResolvedValue([] as never);
    await listActiveClientsAction();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("26 — non-admin redirect rethrow", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(listActiveClientsAction()).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- schemas ---

describe("schemas", () => {
  it("27 — createProjectSchema parse valid", async () => {
    const { createProjectSchema } = await import("@/lib/schemas/project.schemas");
    const result = createProjectSchema.parse({
      name: "Test",
      clientId: "00000000-0000-0000-0000-000000000001",
    });
    expect(result.name).toBe("Test");
  });

  it("28 — createProjectSchema reject invalid clientId", async () => {
    const { createProjectSchema } = await import("@/lib/schemas/project.schemas");
    expect(() => createProjectSchema.parse({ name: "Test", clientId: "not-uuid" })).toThrow();
  });

  it("29 — updateProjectSchema partial", async () => {
    const { updateProjectSchema } = await import("@/lib/schemas/project.schemas");
    const result = updateProjectSchema.parse({ name: "Only name" });
    expect(result.name).toBe("Only name");
    expect(result.clientId).toBeUndefined();
  });

  it("30 — transitionStatusSchema enum valid", async () => {
    const { transitionStatusSchema } = await import("@/lib/schemas/project.schemas");
    const result = transitionStatusSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      newStatus: "active",
    });
    expect(result.newStatus).toBe("active");
  });

  it("31 — transitionStatusSchema enum invalid", async () => {
    const { transitionStatusSchema } = await import("@/lib/schemas/project.schemas");
    expect(() =>
      transitionStatusSchema.parse({
        id: "00000000-0000-0000-0000-000000000001",
        newStatus: "bogus",
      }),
    ).toThrow();
  });
});
