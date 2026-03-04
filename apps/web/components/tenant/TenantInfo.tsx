"use client";

import { useTenant } from "../../contexts/TenantContext";
import { Badge } from "@/components/ui/badge";

export function TenantInfo() {
  const { tenant, currentUser } = useTenant();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <span>
        Espace :{" "}
        <strong className="text-foreground font-medium">{tenant.slug}</strong>
      </span>
      <span>
        Plan :{" "}
        <Badge variant="outline" className="ml-1">
          {tenant.plan}
        </Badge>
      </span>
      <span>
        Rôle :{" "}
        <Badge variant="secondary" className="ml-1">
          {currentUser.role}
        </Badge>
      </span>
    </div>
  );
}
