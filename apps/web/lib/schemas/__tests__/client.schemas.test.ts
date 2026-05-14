import { describe, it, expect } from "vitest";
import { createClientSchema, updateClientSchema } from "../client.schemas";

describe("createClientSchema", () => {
  it("accepts valid input", () => {
    const input = {
      name: "Acme Corp",
      slug: "acme-corp",
      type: "company",
    };
    expect(createClientSchema.parse(input)).toMatchObject(input);
  });

  it("rejects missing name", () => {
    expect(() => createClientSchema.parse({ slug: "x" })).toThrow();
  });

  it("rejects missing slug", () => {
    expect(() => createClientSchema.parse({ name: "x" })).toThrow();
  });

  it("defaults type to company", () => {
    const result = createClientSchema.parse({ name: "x", slug: "x" });
    expect(result.type).toBe("company");
  });

  it("accepts empty string for email", () => {
    const result = createClientSchema.parse({ name: "x", slug: "x", email: "" });
    expect(result.email).toBe("");
  });

  it("rejects invalid email", () => {
    expect(() =>
      createClientSchema.parse({ name: "x", slug: "x", email: "bad" }),
    ).toThrow();
  });
});

describe("updateClientSchema", () => {
  it("accepts partial input", () => {
    const input = { name: "Updated" };
    expect(updateClientSchema.parse(input)).toMatchObject(input);
  });

  it("accepts empty object", () => {
    expect(updateClientSchema.parse({})).toEqual({});
  });
});
