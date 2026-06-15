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
  SMTP_HOST: z.string().optional(),
  NOTIFICATIONS_ENABLED: z.enum(["true", "false"]).transform(v => v === "true").default("false"),
}).refine(
  (data) => !data.NOTIFICATIONS_ENABLED
    || (!!data.SMTP_HOST && data.SMTP_HOST.length > 0)
    || (!!data.RESEND_API_KEY && data.RESEND_API_KEY.length > 0),
  { message: "SMTP_HOST or RESEND_API_KEY is required when NOTIFICATIONS_ENABLED=true" },
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
  STRIPE_WEBHOOKS_ENABLED: z.enum(["true", "false"]).transform(v => v === "true").default("false"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
}).refine(
  (data) => !data.STRIPE_WEBHOOKS_ENABLED || (!!data.STRIPE_SECRET_KEY && data.STRIPE_SECRET_KEY.length > 0),
  { message: "STRIPE_SECRET_KEY is required when STRIPE_WEBHOOKS_ENABLED=true" },
).refine(
  (data) => !data.STRIPE_WEBHOOKS_ENABLED || (!!data.STRIPE_WEBHOOK_SECRET && data.STRIPE_WEBHOOK_SECRET.length > 0),
  { message: "STRIPE_WEBHOOK_SECRET is required when STRIPE_WEBHOOKS_ENABLED=true" },
);

describe("RESEND_API_KEY conditional validation", () => {
  it("returns_boolean_true_when_notifications_enabled_is_true", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "re_x" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NOTIFICATIONS_ENABLED).toBe(true);
    }
  });

  it("defaults_to_false_when_notifications_enabled_is_undefined", () => {
    const result = notificationsEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NOTIFICATIONS_ENABLED).toBe(false);
    }
  });

  it("rejects_typo_value_for_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "tru" });
    expect(result.success).toBe(false);
  });

  it("rejects_missing_transport_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true" });
    expect(result.success).toBe(false);
  });

  it("rejects_missing_transport_with_correct_error_message", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes("SMTP_HOST or RESEND_API_KEY"))).toBe(true);
    }
  });

  it("accepts_missing_resend_key_when_notifications_disabled", () => {
    const result = notificationsEnvSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts_valid_resend_key_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", RESEND_API_KEY: "re_xxx" });
    expect(result.success).toBe(true);
  });

  it("accepts_smtp_host_only_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", SMTP_HOST: "localhost" });
    expect(result.success).toBe(true);
  });

  it("rejects_empty_transport_strings_when_notifications_enabled", () => {
    const result = notificationsEnvSchema.safeParse({ NOTIFICATIONS_ENABLED: "true", SMTP_HOST: "", RESEND_API_KEY: "" });
    expect(result.success).toBe(false);
  });
});

describe("STRIPE_SECRET_KEY conditional validation", () => {
  it("returns_boolean_true_when_stripe_webhooks_enabled", () => {
    const result = stripeEnvSchema.safeParse({
      STRIPE_WEBHOOKS_ENABLED: "true",
      STRIPE_SECRET_KEY: "sk_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.STRIPE_WEBHOOKS_ENABLED).toBe(true);
    }
  });

  it("defaults_to_false_when_stripe_webhooks_enabled_absent", () => {
    const result = stripeEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.STRIPE_WEBHOOKS_ENABLED).toBe(false);
    }
  });

  it("rejects_typo_value_for_stripe_webhooks_enabled", () => {
    const result = stripeEnvSchema.safeParse({ STRIPE_WEBHOOKS_ENABLED: "tru" });
    expect(result.success).toBe(false);
  });

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

const logLevelEnvSchema = z.object({
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

describe("LOG_LEVEL validation", () => {
  it("defaults_log_level_to_info", () => {
    const result = logLevelEnvSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("rejects_invalid_log_level", () => {
    const result = logLevelEnvSchema.safeParse({ LOG_LEVEL: "verbose" });
    expect(result.success).toBe(false);
  });

  it("accepts_all_valid_log_level_values", () => {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      const result = logLevelEnvSchema.safeParse({ LOG_LEVEL: level });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.LOG_LEVEL).toBe(level);
      }
    }
  });
});
