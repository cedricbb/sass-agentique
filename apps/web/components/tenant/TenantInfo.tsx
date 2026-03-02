"use client";

import { useTenant } from "../../contexts/TenantContext";

export function TenantInfo() {
  const { tenant, currentUser } = useTenant();

  return (
    <p className="text-gray-500">
      Espace : <strong>{tenant.slug}</strong> · Plan : {tenant.plan} · Rôle :{" "}
      {currentUser.role}
    </p>
  );
}
