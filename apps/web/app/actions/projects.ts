"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectSchema,
  updateProjectSchema,
  transitionStatusSchema,
  type ProjectCreateValues,
  type ProjectUpdateValues,
  type ProjectStatus,
} from "@/lib/schemas/project.schemas";
import {
  getProjectById,
  createProject,
  updateProject,
  transitionStatus,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Project } from "@saas/db";

export async function createProjectAction(
  input: ProjectCreateValues,
): Promise<ActionResult<Project>> {
  return withAdmin(async () => {
    const data = createProjectSchema.parse(input);
    const payload: Record<string, unknown> = {
      clientId: data.clientId,
      name: data.name,
    };
    if (data.slug !== undefined) payload.slug = data.slug;
    if (data.status !== undefined) payload.status = data.status;
    if (data.description !== undefined) payload.description = data.description;
    const project = await createProject(payload as never);
    revalidatePath("/admin/projects");
    return project;
  });
}

export async function updateProjectAction(
  id: string,
  input: ProjectUpdateValues,
): Promise<ActionResult<Project>> {
  return withAdmin(async () => {
    const data = updateProjectSchema.parse(input);
    const patch: Record<string, unknown> = {};
    if (data.clientId !== undefined) patch.clientId = data.clientId;
    if (data.name !== undefined) patch.name = data.name;
    if (data.slug !== undefined) patch.slug = data.slug;
    if (data.description !== undefined) patch.description = data.description;
    const project = await updateProject(id, patch as never);
    if (project === null) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${id}`);
    return project;
  });
}

export async function transitionStatusAction(
  id: string,
  newStatus: ProjectStatus,
): Promise<ActionResult<Project>> {
  return withAdmin(async () => {
    const data = transitionStatusSchema.parse({ status: newStatus });
    const project = await transitionStatus(id, data.status);
    if (project === null) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${id}`);
    return project;
  });
}

export async function getProjectByIdAction(
  id: string,
): Promise<ActionResult<Project | null>> {
  return withAdmin(async () => {
    return getProjectById(id);
  });
}
