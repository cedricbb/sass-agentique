import { describe, it, expect } from "vitest";
import { z } from "zod";

// On teste le schéma Zod directement, indépendamment de dotenv
const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().default("3000"),
});

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
