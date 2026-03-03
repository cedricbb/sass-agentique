import type { AbilityBuilder } from "@casl/ability";
import type { AppAbility, MembershipRole } from "./types";

export function definePermissions(
  builder: AbilityBuilder<AppAbility>,
  role: MembershipRole,
): void {
  const { can } = builder;

  switch (role) {
    case "OWNER":
      can("manage", "all");
      break;

    case "ADMIN":
      can("read", "Tenant");
      can("read", "Member");
      can("invite", "Member");
      can("remove", "Member");
      can("read", "Invitation");
      can("cancel", "Invitation");
      break;

    case "MEMBER":
      can("read", "Tenant");
      can("read", "Member");
      break;

    case "VIEWER":
      can("read", "Tenant");
      break;
  }
}
