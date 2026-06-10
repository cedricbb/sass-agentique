import { z } from "zod";
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(process.cwd(), ".env") });
config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.string().default("3000"),
  SESSION_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  TOTP_ISSUER: z.string().optional().default("SaaS Agentique"),
  NOTIFICATIONS_ENABLED: z.enum(["true", "false"]).transform(v => v === "true").default("false"),
  STRIPE_WEBHOOKS_ENABLED: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
}).refine(
  (data) => !data.NOTIFICATIONS_ENABLED || (data.RESEND_API_KEY !== undefined && data.RESEND_API_KEY.length > 0),
  { message: "RESEND_API_KEY is required when NOTIFICATIONS_ENABLED=true" },
).refine(
  (data) => data.STRIPE_WEBHOOKS_ENABLED !== "true" || (!!data.STRIPE_SECRET_KEY && data.STRIPE_SECRET_KEY.length > 0),
  { message: "STRIPE_SECRET_KEY is required when STRIPE_WEBHOOKS_ENABLED=true" },
).refine(
  (data) => data.STRIPE_WEBHOOKS_ENABLED !== "true" || (!!data.STRIPE_WEBHOOK_SECRET && data.STRIPE_WEBHOOK_SECRET.length > 0),
  { message: "STRIPE_WEBHOOK_SECRET is required when STRIPE_WEBHOOKS_ENABLED=true" },
);

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const env = _env.data;

export { isAllowedRedirectUrl } from './allowed-urls';
export { PLANS } from './plans';
export type { PlanId, PlanConfig } from './plans';
export { syncPlansToStripe } from './stripe-sync';
export type { StripeSyncResult } from './stripe-sync';
