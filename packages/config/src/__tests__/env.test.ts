import { describe, it, expect } from "vitest";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().default("3000"),
});

const notificationsEnvSchema = z.object({
  RESEND_API_KEY: z.string().optional(),
  NOTIFICATIONS_ENABLED: z.string().optional(),
}).refine(
  (data) => data.NOTIFICATIONS_ENABLED !== "true" || (data.RESEND_API_KEY !== undefined && data.RESEND_API_KEY.length > 0),
  { message: "RESEND_API_KEY is required when NOTIFICATIONS_ENABLED=true" },
);

describe("schéma Zod env", () => {
  it("accepte un DATABASE_URL valide", () => {
    const result = envSchema.safeParse({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
      NODE_ENV: "development",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBe(
        "postgresql://user:pass@localhost:5432/testdb",
      );
    }
  });

  it("applique NODE_ENV=development par défaut", () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("applique PORT=3000 par défaut", () => {
    const result = envSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe("3000");
    }
  });

  it("accepte un PORT personnalisé", () => {
    const result = envSchema.safeParse({ PORT: "8080" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe("8080");
    }
  });

  it("accepte production comme NODE_ENV valide", () => {
    const result = envSchema.safeParse({ NODE_ENV: "production" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("production");
    }
  });

  it("accepte test comme NODE_ENV valide", () => {
    const result = envSchema.safeParse({ NODE_ENV: "test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("test");
    }
  });

  it("rejette un NODE_ENV invalide", () => {
    const result = envSchema.safeParse({ NODE_ENV: "staging" });
    expect(result.success).toBe(false);
  });

  it("accepte DATABASE_URL absent (optionnel)", () => {
    const result = envSchema.safeParse({ NODE_ENV: "development" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DATABASE_URL).toBeUndefined();
    }
  });

  it("rejette un DATABASE_URL mal formé", () => {
    const result = envSchema.safeParse({ DATABASE_URL: "pas-une-url" });
    expect(result.success).toBe(false);
  });
});

const stripeEnvSchema = z.object({
  STRIPE_WEBHOOKS_ENABLED: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
}).refine(
  (data) => data.STRIPE_WEBHOOKS_ENABLED !== "true" || (!!data.STRIPE_SECRET_KEY && data.STRIPE_SECRET_KEY.length > 0),
  { message: "STRIPE_SECRET_KEY is required when STRIPE_WEBHOOKS_ENABLED=true" },
).refine(
  (data) => data.STRIPE_WEBHOOKS_ENABLED !== "true" || (!!data.STRIPE_WEBHOOK_SECRET && data.STRIPE_WEBHOOK_SECRET.length > 0),
  { message: "STRIPE_WEBHOOK_SECRET is required when STRIPE_WEBHOOKS_ENABLED=true" },
);

describe("RESEND_API_KEY conditional validation", () => {
  it("rejects_missing_resend_key_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true" });
    expect(result.success).toBe(false);
  });

  it("accepts_missing_resend_key_when_notifications_disabled", () => {
    const result = notificationsEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts_valid_resend_key_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "re_xxx" });
    expect(result.success).toBe(true);
  });

  it("rejects_empty_resend_key_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "" });
    expect(result.success).toBe(false);
  });
});

describe("STRIPE_SECRET_KEY conditional validation", () => {
  it("rejects_missing_stripe_keys_when_webhooks_enabled", () => {
    const result = stripeEnvSchema.safeParse({ STRIPE_WEBHOOKS_ENABLED: "true" });
    expect(result.success).toBe(false);
  });

  it("accepts_missing_stripe_keys_when_webhooks_disabled", () => {
    const result = stripeEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts_valid_stripe_keys_when_webhooks_enabled", () => {
    const result = stripeEnvSchema.safeParse({
      STRIPE_WEBHOOKS_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_test_xxx",
      STRIPE_WEBHOOK_SECRET: "whsec_xxx",
    });
    expect(result.success).toBe(true);
  });

  it("rejects_empty_stripe_secret_key_when_webhooks_enabled", () => {
    const result = stripeEnvSchema.safeParse({
      STRIPE_WEBHOOKS_ENABLED: "true",
      STRIPE_SECRET_KEY: "",
      STRIPE_WEBHOOK_SECRET: "whsec_xxx",
    });
    expect(result.success).toBe(false);
  });
});
