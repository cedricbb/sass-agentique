import { describe, it, expect } from "vitest";
import { generateSlug } from "../utils/slug";

describe("generateSlug", () => {
  it("converts name to slug", () => {
    expect(generateSlug("My Project")).toBe("my-project");
  });

  it("extracts local part from email", () => {
    expect(generateSlug("user@example.com")).toBe("user");
  });

  it("removes special characters", () => {
    expect(generateSlug("hello!#$world")).toBe("helloworld");
  });

  it("collapses multiple dashes", () => {
    expect(generateSlug("a - - b")).toBe("a-b");
  });

  it("trims leading and trailing dashes", () => {
    expect(generateSlug("-hello-")).toBe("hello");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(60);
    expect(generateSlug(long)).toHaveLength(50);
  });

  it("returns empty string for empty input", () => {
    expect(generateSlug("")).toBe("");
  });

  it("handles email with special chars before @", () => {
    expect(generateSlug("john.doe+test@example.com")).toBe("johndoetest");
  });
});
