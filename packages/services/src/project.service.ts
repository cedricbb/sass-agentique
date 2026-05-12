import {
  db,
  projects,
  projectStatusEnum,
  type Project,
  type NewProject,
} from "@saas/db";
import { eq, and, inArray } from "drizzle-orm";
import { generateSlug } from "./utils/slug";

export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];

export type ListAllProjectsOptions = {
  status?: ProjectStatus | ProjectStatus[];
};

export type CreateProjectInput = Omit<NewProject, "slug"> & { slug?: string };

export type UpdateProjectPatch = Omit<Partial<NewProject>, "status">;

export class InvalidProjectTransitionError extends Error {
  constructor(from: ProjectStatus, to: ProjectStatus) {
    super(`Invalid transition from "${from}" to "${to}"`);
    this.name = "InvalidProjectTransitionError";
  }
}

export const VALID_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ["active", "cancelled"],
  active: ["on_hold", "delivered", "cancelled"],
  on_hold: ["active", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export async function listProjectsByClient(clientId: string): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .where(eq(projects.clientId, clientId));
}

export async function listAllProjects(opts?: ListAllProjectsOptions): Promise<Project[]> {
  if (!opts?.status) {
    return db.select().from(projects);
  }
  if (Array.isArray(opts.status)) {
    return db
      .select()
      .from(projects)
      .where(inArray(projects.status, opts.status));
  }
  return db
    .select()
    .from(projects)
    .where(eq(projects.status, opts.status));
}

export async function getProjectById(id: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

export async function getProjectBySlug(clientId: string, slug: string): Promise<Project | null> {
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.clientId, clientId), eq(projects.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const slug = input.slug ?? generateSlug(input.name);
  const [row] = await db
    .insert(projects)
    .values({ ...input, slug })
    .returning();
  return row;
}

export async function updateProject(id: string, patch: UpdateProjectPatch): Promise<Project | null> {
  if ("status" in patch) {
    throw new Error("Cannot update status via updateProject. Use transitionStatus instead.");
  }
  const [row] = await db
    .update(projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

export async function transitionStatus(id: string, newStatus: ProjectStatus): Promise<Project | null> {
  const current = await getProjectById(id);
  if (!current) return null;

  if (!canTransition(current.status as ProjectStatus, newStatus)) {
    throw new InvalidProjectTransitionError(current.status as ProjectStatus, newStatus);
  }

  const timestamps: Record<string, Date> = {};
  if (newStatus === "active" && !current.startedAt) {
    timestamps.startedAt = new Date();
  }
  if (newStatus === "delivered" && !current.deliveredAt) {
    timestamps.deliveredAt = new Date();
  }

  const [row] = await db
    .update(projects)
    .set({ status: newStatus, updatedAt: new Date(), ...timestamps })
    .where(eq(projects.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id));
}
