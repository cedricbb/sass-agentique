import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TenantProvider, type TenantContextValue } from "../../../contexts/TenantContext";
import type { ReactNode } from "react";

export default async function TenantLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const tenantSlug = headersList.get("x-tenant-slug");
  const tenantPlan = headersList.get("x-tenant-plan");
  const userId = headersList.get("x-user-id");
  const userRole = headersList.get("x-user-role") as TenantContextValue["currentUser"]["role"] | null;

  if (!tenantId || !tenantSlug || !userId || !userRole) {
    redirect("/login");
  }

  const value: TenantContextValue = {
    tenant: {
      id: tenantId,
      slug: tenantSlug,
      plan: tenantPlan ?? "free",
    },
    currentUser: {
      id: userId,
      role: userRole,
    },
  };

  return <TenantProvider value={value}>{children}</TenantProvider>;
}
