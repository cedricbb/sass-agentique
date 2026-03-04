import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, getTenantBySlug, getUserRole } from "@saas/services";
import { TenantProvider, type TenantContextValue } from "../../../contexts/TenantContext";
import { AppShell } from "../../../components/layout/AppShell";
import type { ReactNode } from "react";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect("/");

  const role = await getUserRole(user.id, tenant.id);
  if (!role) redirect("/");

  const value: TenantContextValue = {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      plan: tenant.plan,
    },
    currentUser: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      emailVerified: user.emailVerified,
    },
  };

  return (
    <TenantProvider value={value}>
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
