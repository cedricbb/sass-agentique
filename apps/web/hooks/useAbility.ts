"use client";

import { useTenant } from "../contexts/TenantContext";
import { createAbility } from "@saas/permissions";
import type { AppAbility } from "@saas/permissions";

export function useAbility(): AppAbility {
  const { currentUser } = useTenant();
  return createAbility(currentUser.role);
}
