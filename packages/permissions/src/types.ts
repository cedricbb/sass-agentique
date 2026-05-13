import type { MongoAbility } from "@casl/ability";

export type UserRole = "admin" | "client";
export type Action = "manage";
export type Subject =
  | "Client"
  | "Project"
  | "Prestation"
  | "Quote"
  | "Invoice"
  | "Payment"
  | "Report"
  | "MaintenanceContract"
  | "all";
export type AppAbility = MongoAbility<[Action, Subject]>;
