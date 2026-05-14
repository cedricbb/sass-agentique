"use server";

import { revalidatePath } from "next/cache";
import { createProjectSchema, updateProjectSchema, transitionStatusSchema } from "@/lib/schemas/project.schemas";
import {
  createProject,
  updateProject,
  transitionStatus,
  getProjectById,
  listClients,
} from "@saas/services";
import { withAdmin, type ActionResult } from "@/lib/action-result";
import type { Project, Client } from "@saas/db";

export async function createProjectAction(
  input: unknown,
): Promise<ActionResult<Project>> {
  return withAdmin(async () => {
    const data = createProjectSchema.parse(input);
    const project = await createProject(data as never);
    revalidatePath("/admin/projects");
    return project;
  });
}

export async function updateProjectAction(
  id: string,
  input: unknown,
): Promise<ActionResult<Project | null>> {
  return withAdmin(async () => {
    const data = updateProjectSchema.parse(input);
    const project = await updateProject(id, data as never);
    if (project === null) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    revalidatePath("/admin/projects");
    return project;
  });
}

export async function transitionStatusAction(
  input: unknown,
): Promise<ActionResult<Project>> {
  return withAdmin(async () => {
    const { id, newStatus } = transitionStatusSchema.parse(input);
    const project = await transitionStatus(id, newStatus as never);
    if (project === null) {
      throw new Error("PROJECT_NOT_FOUND");
    }
    revalidatePath("/admin/projects");
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

export async function listActiveClientsAction(): Promise<ActionResult<Client[]>> {
  return withAdmin(async () => {
    return listClients();
  });
}
