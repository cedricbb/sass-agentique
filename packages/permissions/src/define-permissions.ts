import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { AppAbility, UserRole } from "./types";

export function definePermissions(role: UserRole): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (role === "admin") {
    can("manage", "all");
  }

  return build();
}
