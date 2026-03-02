import { z } from "zod";
import { config } from "dotenv";
import path from "path";

// Load .env from current directory or root
config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
  // Auth — Phase 1
  SESSION_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().url().optional(),
  // Email — Phase 1
  RESEND_API_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const env = _env.data;
