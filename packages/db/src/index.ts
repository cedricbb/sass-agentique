import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@saas/config";

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema });
export * from "./schema";
