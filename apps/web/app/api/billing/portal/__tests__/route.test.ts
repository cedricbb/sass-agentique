import { describe, it, expect, vi, beforeEach } from "vitest";

const mockValidateSession = vi.fn();
const mockCreatePortalSession = vi.fn();

vi.mock("@saas/services", () => ({
  validateSession: mockValidateSession,
  StripeService: vi.fn().mockImplementation(() => ({
    createPortalSession: mockCreatePortalSession,
  })),
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock("@saas/db", () => ({
  db: {
    select: mockSelect,
  },
  memberships: { tenantId: "tenantId", userId: "userId" },
  tenants: { id: "id", stripeCustomerId: "stripeCustomerId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === "session-token") return { value: "valid-token" };
      return undefined;
    }),
  }),
}));

function setupDbChain(results: unknown[]) {
  mockLimit.mockResolvedValue(results);
  mockWhere.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

function setupDbChainNoLimit(results: unknown[]) {
  mockWhere.mockResolvedValue(results);
  mockFrom.mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  });

  it("AC1: returns 401 when no session cookie", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValueOnce({
      get: vi.fn(() => undefined),
    } as any);

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("AC1: returns 401 when session is invalid", async () => {
    mockValidateSession.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("returns 400 when user has no membership", async () => {
    mockValidateSession.mockResolvedValue({ id: "user-1" });
    setupDbChain([]);

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "tenant_not_found" });
  });

  it("AC2: returns 400 when tenant has no stripeCustomerId", async () => {
    mockValidateSession.mockResolvedValue({ id: "user-1" });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockLimit.mockResolvedValue([{ tenantId: "tenant-1" }]);
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockFrom.mockReturnValue({ where: mockWhere });
        return { from: mockFrom };
      }
      mockWhere.mockResolvedValue([{ stripeCustomerId: null }]);
      mockFrom.mockReturnValue({ where: mockWhere });
      return { from: mockFrom };
    });

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "stripe_customer_not_found" });
  });

  it("AC3+AC4: returns portal URL with correct returnUrl", async () => {
    mockValidateSession.mockResolvedValue({ id: "user-1" });
    mockCreatePortalSession.mockResolvedValue({ url: "https://billing.stripe.com/session/xyz" });

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockLimit.mockResolvedValue([{ tenantId: "tenant-1" }]);
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockFrom.mockReturnValue({ where: mockWhere });
        return { from: mockFrom };
      }
      mockWhere.mockResolvedValue([{ stripeCustomerId: "cus_abc123" }]);
      mockFrom.mockReturnValue({ where: mockWhere });
      return { from: mockFrom };
    });

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/session/xyz" });
    expect(mockCreatePortalSession).toHaveBeenCalledWith(
      "tenant-1",
      "cus_abc123",
      "https://app.example.com/settings/billing"
    );
  });

  it("returns 500 when Stripe service throws", async () => {
    mockValidateSession.mockResolvedValue({ id: "user-1" });
    mockCreatePortalSession.mockRejectedValue(new Error("Stripe network error"));

    let callCount = 0;
    mockSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        mockLimit.mockResolvedValue([{ tenantId: "tenant-1" }]);
        mockWhere.mockReturnValue({ limit: mockLimit });
        mockFrom.mockReturnValue({ where: mockWhere });
        return { from: mockFrom };
      }
      mockWhere.mockResolvedValue([{ stripeCustomerId: "cus_abc123" }]);
      mockFrom.mockReturnValue({ where: mockWhere });
      return { from: mockFrom };
    });

    const { POST } = await import("../route");
    const res = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});
