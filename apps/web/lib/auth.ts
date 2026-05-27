import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { validateSession, getPrimaryClientForUser } from "@saas/services";
import type { Client } from "@saas/db";

export const SESSION_COOKIE_NAME = "session-token";

export type AdminUser = NonNullable<
  Awaited<ReturnType<typeof validateSession>>
>;

export async function getSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const user = await validateSession(token);
  return user ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");
  return user;
}

export type CustomerUser = NonNullable<Awaited<ReturnType<typeof validateSession>>>;

export type CustomerScope = { user: CustomerUser; client: Client };

export class CustomerNoClientError extends Error {
  constructor() { super("Aucun client associé à ce compte."); }
}

export class ForbiddenScopeError extends Error {
  constructor() { super("Ressource introuvable."); }
}

export async function requireCustomer(): Promise<CustomerScope> {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "client") redirect("/admin");
  const client = await getPrimaryClientForUser(user.id);
  if (!client) redirect("/customer/no-client");
  return { user, client };
}

export function assertClientOwnership<T extends { clientId: string }>(
  entity: T | null,
  scope: CustomerScope,
): T {
  if (!entity) notFound();
  if (entity.clientId !== scope.client.id) notFound();
  return entity;
}

export function assertClientOwnershipOrThrow<T extends { clientId: string }>(
  entity: T | null,
  scope: CustomerScope,
): T {
  if (!entity) throw new ForbiddenScopeError();
  if (entity.clientId !== scope.client.id) throw new ForbiddenScopeError();
  return entity;
}
