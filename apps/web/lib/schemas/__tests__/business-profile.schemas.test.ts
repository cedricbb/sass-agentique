import { describe, it, expect } from "vitest";
import { businessProfileSchema } from "../business-profile.schemas";

describe("businessProfileSchema", () => {
  it("accepts_valid_input_with_name_only", () => {
    const result = businessProfileSchema.parse({ name: "ACME" });
    expect(result.name).toBe("ACME");
  });

  it("rejects_invalid_siret_format", () => {
    expect(() => businessProfileSchema.parse({ name: "X", siret: "123" })).toThrow();
  });

  it("accepts_empty_string_siret", () => {
    const result = businessProfileSchema.parse({ name: "X", siret: "" });
    expect(result.siret).toBe("");
  });

  it("rejects_invalid_email", () => {
    expect(() => businessProfileSchema.parse({ name: "X", email: "bad" })).toThrow();
  });

  it("accepts_empty_string_email", () => {
    const result = businessProfileSchema.parse({ name: "X", email: "" });
    expect(result.email).toBe("");
  });
});
