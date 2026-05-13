import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";

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
