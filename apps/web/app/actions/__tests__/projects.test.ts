import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", async () => {
  const actual = await vi.importActual<typeof import("@saas/services")>("@saas/services");
  return {
    ...actual,
    createProject: vi.fn(),
    updateProject: vi.fn(),
    transitionStatus: vi.fn(),
    getProjectById: vi.fn(),
  };
});

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
} from "../projects";
import {
  createProject,
  updateProject,
  transitionStatus,
  getProjectById,
  InvalidProjectTransitionError,
} from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateProject = vi.mocked(createProject);
const mockedUpdateProject = vi.mocked(updateProject);
const mockedTransitionStatus = vi.mocked(transitionStatus);
const mockedGetProjectById = vi.mocked(getProjectById);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "660e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = {
  id: "admin-1",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const mockProject = {
  id: "proj-1",
  clientId: VALID_UUID,
  slug: "proj-alpha",
  name: "Project Alpha",
  status: "draft",
  description: null,
  startedAt: null,
  deliveredAt: null,
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

describe("createProjectAction", () => {
  const validInput = { clientId: VALID_UUID, name: "Project Alpha" };

  it("C1 — happy path", async () => {
    mockedCreateProject.mockResolvedValue(mockProject as never);
    const result = await createProjectAction(validInput);
    expect(result).toEqual({ ok: true, data: mockProject });
    expect(mockedCreateProject).toHaveBeenCalledWith({
      clientId: VALID_UUID,
      name: "Project Alpha",
    });
  });

  it("C2 — revalidatePath called", async () => {
    mockedCreateProject.mockResolvedValue(mockProject as never);
    await createProjectAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
  });

  it("C3 — clientId UUID invalide", async () => {
    const result = await createProjectAction({
      clientId: "not-a-uuid",
      name: "Test",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("C4 — name vide", async () => {
    const result = await createProjectAction({
      clientId: VALID_UUID,
      name: "",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("C5 — status optionnel active", async () => {
    mockedCreateProject.mockResolvedValue({
      ...mockProject,
      status: "active",
    } as never);
    await createProjectAction({
      clientId: VALID_UUID,
      name: "Test",
      status: "active",
    });
    expect(mockedCreateProject).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });
});

describe("updateProjectAction", () => {
  it("U1 — happy path patch défensif", async () => {
    mockedUpdateProject.mockResolvedValue(mockProject as never);
    const result = await updateProjectAction("proj-1", { name: "New Name" });
    expect(result).toEqual({ ok: true, data: mockProject });
    expect(mockedUpdateProject).toHaveBeenCalledWith("proj-1", {
      name: "New Name",
    });
  });

  it("U2 — revalidatePath ×2", async () => {
    mockedUpdateProject.mockResolvedValue(mockProject as never);
    await updateProjectAction("proj-1", { name: "New Name" });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(
      "/admin/projects/proj-1",
    );
  });

  it("U3 — clientId modifiable", async () => {
    mockedUpdateProject.mockResolvedValue(mockProject as never);
    await updateProjectAction("proj-1", { clientId: OTHER_UUID });
    expect(mockedUpdateProject).toHaveBeenCalledWith("proj-1", {
      clientId: OTHER_UUID,
    });
  });

  it("U4 — status dans patch → strip zod", async () => {
    mockedUpdateProject.mockResolvedValue(mockProject as never);
    await updateProjectAction("proj-1", {
      name: "Test",
      status: "active",
    } as never);
    expect(mockedUpdateProject).toHaveBeenCalledWith("proj-1", {
      name: "Test",
    });
  });

  it("U5 — service null → INTERNAL_ERROR", async () => {
    mockedUpdateProject.mockResolvedValue(null as never);
    const result = await updateProjectAction("proj-1", { name: "Test" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("U6 — patch vide", async () => {
    mockedUpdateProject.mockResolvedValue(mockProject as never);
    const result = await updateProjectAction("proj-1", {});
    expect(result).toEqual({ ok: true, data: mockProject });
    expect(mockedUpdateProject).toHaveBeenCalledWith("proj-1", {});
  });
});

describe("transitionStatusAction", () => {
  it("T1 — happy path draft→active", async () => {
    mockedTransitionStatus.mockResolvedValue({
      ...mockProject,
      status: "active",
    } as never);
    const result = await transitionStatusAction("proj-1", "active");
    expect(result).toMatchObject({ ok: true });
    expect(mockedTransitionStatus).toHaveBeenCalledWith("proj-1", "active");
  });

  it("T2 — happy path active→delivered", async () => {
    const delivered = { ...mockProject, status: "delivered" };
    mockedTransitionStatus.mockResolvedValue(delivered as never);
    const result = await transitionStatusAction("proj-1", "delivered");
    expect(result).toEqual({ ok: true, data: delivered });
  });

  it("T3 — InvalidProjectTransitionError → 409", async () => {
    mockedTransitionStatus.mockRejectedValue(
      new InvalidProjectTransitionError("draft", "delivered"),
    );
    const result = await transitionStatusAction("proj-1", "delivered");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "PROJECT_INVALID_TRANSITION" },
    });
  });

  it("T4 — newStatus bogus → VALIDATION_ERROR", async () => {
    const result = await transitionStatusAction("proj-1", "bogus" as never);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T5 — revalidatePath ×2", async () => {
    mockedTransitionStatus.mockResolvedValue({
      ...mockProject,
      status: "active",
    } as never);
    await transitionStatusAction("proj-1", "active");
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/projects");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(
      "/admin/projects/proj-1",
    );
  });

  it("T6 — service null → INTERNAL_ERROR", async () => {
    mockedTransitionStatus.mockResolvedValue(null as never);
    const result = await transitionStatusAction("proj-1", "active");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("T7 — transition vers cancelled", async () => {
    mockedTransitionStatus.mockResolvedValue({
      ...mockProject,
      status: "cancelled",
    } as never);
    await transitionStatusAction("proj-1", "cancelled");
    expect(mockedTransitionStatus).toHaveBeenCalledWith("proj-1", "cancelled");
  });

  it("T8 — 5 statuses acceptés par schema", async () => {
    const { transitionStatusSchema } = await import(
      "@/lib/schemas/project.schemas"
    );
    const statuses = [
      "draft",
      "active",
      "on_hold",
      "delivered",
      "cancelled",
    ] as const;
    for (const s of statuses) {
      const result = transitionStatusSchema.safeParse({ status: s });
      expect(result.success).toBe(true);
    }
  });
});

describe("getProjectByIdAction", () => {
  it("G1 — happy path", async () => {
    mockedGetProjectById.mockResolvedValue(mockProject as never);
    const result = await getProjectByIdAction("proj-1");
    expect(result).toEqual({ ok: true, data: mockProject });
  });

  it("G2 — null si non trouvé", async () => {
    mockedGetProjectById.mockResolvedValue(null);
    const result = await getProjectByIdAction("proj-999");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("G3 — pas de revalidatePath", async () => {
    mockedGetProjectById.mockResolvedValue(mockProject as never);
    await getProjectByIdAction("proj-1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("Transversaux", () => {
  it("N1 — NEXT_REDIRECT propagé", async () => {
    mockedCreateProject.mockRejectedValue(makeRedirectError());
    await expect(
      createProjectAction({ clientId: VALID_UUID, name: "Test" }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("N2 — delete/list NON exposés", async () => {
    const mod = await import("../projects");
    expect(
      (mod as Record<string, unknown>).deleteProjectAction,
    ).toBeUndefined();
    expect(
      (mod as Record<string, unknown>).listAllProjectsAction,
    ).toBeUndefined();
  });
});
