import type { MongoAbility } from "@casl/ability";

export type Action = "read" | "invite" | "remove" | "update" | "cancel" | "manage";
export type Subject = "Member" | "Invitation" | "Tenant" | "all";
export type AppAbility = MongoAbility<[Action, Subject]>;
export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
