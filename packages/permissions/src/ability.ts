import { definePermissions } from "./define-permissions";
import type { UserRole, AppAbility } from "./types";

export function createAbility(role: UserRole): AppAbility {
  return definePermissions(role);
}
