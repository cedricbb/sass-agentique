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
  return withAdmin(async (user) => {
    const data = createProjectSchema.parse(input);
    const project = await createProject({
      clientId: data.clientId,
      name: data.name,
      ownerId: user.id,
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.description !== undefined && { description: data.description }),
    });
    revalidatePath("/admin/projects");
    return project;
  });
}

export async function updateProjectAction(
  id: string,
  input: ProjectUpdateValues,
): Promise<ActionResult<Project>> {
  return withAdmin(async (user) => {
    const data = updateProjectSchema.parse(input);
    const project = await updateProject(id, {
      ...(data.clientId !== undefined && { clientId: data.clientId }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ownerId: user.id,
    });
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
