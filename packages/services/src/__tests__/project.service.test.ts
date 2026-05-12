import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
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
  projects: {},
  projectStatusEnum: { enumValues: ["draft", "active", "on_hold", "delivered", "cancelled"] },
}));

vi.mock("../utils/slug", () => ({
  generateSlug: vi.fn(() => "generated-slug"),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
}));

import {
  canTransition,
  VALID_TRANSITIONS,
  InvalidProjectTransitionError,
  listProjectsByClient,
  listAllProjects,
  getProjectById,
  getProjectBySlug,
  createProject,
  updateProject,
  transitionStatus,
  deleteProject,
} from "../project.service";
import { generateSlug } from "../utils/slug";

const PROJECT_FIXTURE = {
  id: "p1",
  clientId: "c1",
  name: "Project Alpha",
  slug: "project-alpha",
  status: "draft" as const,
  description: null,
  startedAt: null,
  deliveredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  dbMock = makeDrizzleMock();
  vi.clearAllMocks();
});

describe("canTransition", () => {
  it("allows draft → active", () => {
    expect(canTransition("draft", "active")).toBe(true);
  });

  it("rejects draft → on_hold", () => {
    expect(canTransition("draft", "on_hold")).toBe(false);
  });

  it("rejects delivered → active (terminal)", () => {
    expect(canTransition("delivered", "active")).toBe(false);
  });

  it("rejects cancelled → draft (terminal)", () => {
    expect(canTransition("cancelled", "draft")).toBe(false);
  });
});

describe("VALID_TRANSITIONS", () => {
  it("has correct transition counts", () => {
    expect(VALID_TRANSITIONS.draft).toHaveLength(2);
    expect(VALID_TRANSITIONS.active).toHaveLength(3);
    expect(VALID_TRANSITIONS.on_hold).toHaveLength(2);
    expect(VALID_TRANSITIONS.delivered).toHaveLength(0);
    expect(VALID_TRANSITIONS.cancelled).toHaveLength(0);
  });
});

describe("listProjectsByClient", () => {
  it("filters by clientId", async () => {
    dbMock.where.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await listProjectsByClient("c1");
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([PROJECT_FIXTURE]);
  });
});

describe("listAllProjects", () => {
  it("returns all without opts", async () => {
    dbMock.from.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await listAllProjects();
    expect(dbMock.select).toHaveBeenCalled();
    expect(dbMock.from).toHaveBeenCalled();
    expect(result).toEqual([PROJECT_FIXTURE]);
  });

  it("filters by single status string", async () => {
    dbMock.where.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await listAllProjects({ status: "active" });
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([PROJECT_FIXTURE]);
  });

  it("filters by status array with inArray", async () => {
    dbMock.where.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await listAllProjects({ status: ["active", "draft"] });
    expect(dbMock.where).toHaveBeenCalled();
    expect(result).toEqual([PROJECT_FIXTURE]);
  });
});

describe("getProjectById", () => {
  it("returns project when found", async () => {
    dbMock.limit.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await getProjectById("p1");
    expect(dbMock.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(PROJECT_FIXTURE);
  });

  it("returns null when not found", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await getProjectById("missing");
    expect(result).toBeNull();
  });
});

describe("getProjectBySlug", () => {
  it("returns project when found", async () => {
    dbMock.limit.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await getProjectBySlug("c1", "project-alpha");
    expect(dbMock.where).toHaveBeenCalled();
    expect(dbMock.limit).toHaveBeenCalledWith(1);
    expect(result).toEqual(PROJECT_FIXTURE);
  });
});

describe("createProject", () => {
  it("auto-generates slug when not provided", async () => {
    dbMock.returning.mockResolvedValueOnce([PROJECT_FIXTURE]);
    await createProject({ clientId: "c1", name: "Project Alpha" });
    expect(generateSlug).toHaveBeenCalledWith("Project Alpha");
    expect(dbMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "generated-slug" }),
    );
  });

  it("uses provided slug", async () => {
    dbMock.returning.mockResolvedValueOnce([PROJECT_FIXTURE]);
    await createProject({ clientId: "c1", name: "Project Alpha", slug: "custom-slug" });
    expect(generateSlug).not.toHaveBeenCalled();
    expect(dbMock.values).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "custom-slug" }),
    );
  });
});

describe("updateProject", () => {
  it("updates with patch and sets updatedAt", async () => {
    dbMock.returning.mockResolvedValueOnce([PROJECT_FIXTURE]);
    const result = await updateProject("p1", { name: "New Name" });
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New Name", updatedAt: expect.any(Date) }),
    );
    expect(result).toEqual(PROJECT_FIXTURE);
  });

  it("returns null for unknown id", async () => {
    dbMock.returning.mockResolvedValueOnce([]);
    const result = await updateProject("missing", { name: "X" });
    expect(result).toBeNull();
  });

  it("throws if status is in patch", async () => {
    const badPatch = { name: "X", status: "active" } as any;
    await expect(updateProject("p1", badPatch)).rejects.toThrow();
  });
});

describe("transitionStatus", () => {
  it("transitions draft → active and sets startedAt", async () => {
    dbMock.limit.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "draft" }]);
    dbMock.returning.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "active" }]);
    const result = await transitionStatus("p1", "active");
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", startedAt: expect.any(Date) }),
    );
    expect(result).toEqual(expect.objectContaining({ status: "active" }));
  });

  it("throws on invalid transition draft → on_hold", async () => {
    dbMock.limit.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "draft" }]);
    await expect(transitionStatus("p1", "on_hold")).rejects.toThrow(InvalidProjectTransitionError);
  });

  it("transitions active → delivered and sets deliveredAt", async () => {
    dbMock.limit.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "active", startedAt: new Date() }]);
    dbMock.returning.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "delivered" }]);
    const result = await transitionStatus("p1", "delivered");
    expect(dbMock.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date) }),
    );
    expect(result).toEqual(expect.objectContaining({ status: "delivered" }));
  });

  it("throws on delivered → active (terminal)", async () => {
    dbMock.limit.mockResolvedValueOnce([{ ...PROJECT_FIXTURE, status: "delivered" }]);
    await expect(transitionStatus("p1", "active")).rejects.toThrow(InvalidProjectTransitionError);
  });

  it("returns null for non-existent project", async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const result = await transitionStatus("missing", "active");
    expect(result).toBeNull();
  });
});

describe("deleteProject", () => {
  it("hard deletes by id", async () => {
    dbMock.where.mockResolvedValueOnce(undefined);
    await deleteProject("p1");
    expect(dbMock.delete).toHaveBeenCalled();
    expect(dbMock.where).toHaveBeenCalled();
  });
});
