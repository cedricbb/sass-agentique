import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { eq, type SQL } from "drizzle-orm";

export function ownerScope<T extends { ownerId: AnyPgColumn }>(
  table: T,
  ownerId: string,
): SQL {
  return eq(table.ownerId, ownerId);
}
