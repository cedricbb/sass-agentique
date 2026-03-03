import { AbilityBuilder, createMongoAbility } from "@casl/ability";
import type { AppAbility, MembershipRole } from "./types";
import { definePermissions } from "./define-permissions";

export function createAbility(role: MembershipRole): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
  definePermissions(builder, role);
  return builder.build();
}
