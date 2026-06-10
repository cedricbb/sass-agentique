import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
  RESEND_API_KEY: "test-key-initial" as string | undefined,
}));

vi.mock("@saas/config", () => ({ env: mockEnv }));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({})),
}));

import {
  getResendClient,
  __resetResendClientForTests,
  __getResendClientKeyHashForTests,
} from "../resend.client";

describe("resend_client", () => {
  beforeEach(() => {
    __resetResendClientForTests();
    mockEnv.RESEND_API_KEY = "test-key-initial";
  });

  it("returns_same_instance_on_consecutive_calls", () => {
    const first = getResendClient();
    const second = getResendClient();
    expect(first).toBe(second);
  });

  it("creates_new_instance_on_key_rotation", () => {
    const first = getResendClient();
    const hashBefore = __getResendClientKeyHashForTests();
    mockEnv.RESEND_API_KEY = "rotated-key";
    const second = getResendClient();
    expect(second).not.toBe(first);
    expect(__getResendClientKeyHashForTests()).not.toBe(hashBefore);
  });

  it("throws_when_resend_api_key_undefined", () => {
    mockEnv.RESEND_API_KEY = undefined;
    expect(() => getResendClient()).toThrow("RESEND_API_KEY is not configured");
  });

  it("reset_clears_client_and_hash", () => {
    const first = getResendClient();
    __resetResendClientForTests();
    expect(__getResendClientKeyHashForTests()).toBeNull();
    const second = getResendClient();
    expect(second).not.toBe(first);
  });
});
