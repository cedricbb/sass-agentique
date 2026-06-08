import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("inngest/next", () => ({
  serve: vi.fn(() => ({
    GET: vi.fn(async (_req: Request) =>
      new Response(JSON.stringify({ functions: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    ),
    POST: vi.fn(async (_req: Request) => new Response("", { status: 200 })),
    PUT: vi.fn(async (_req: Request) => new Response("", { status: 200 })),
  })),
}));

vi.mock("@saas/workflows", () => ({
  inngest: {
    id: "saas-agentique",
    createFunction: vi.fn((_config: unknown, _trigger: unknown, _handler: unknown) => ({
      id: _config,
    })),
  },
}));

describe("Inngest runtime wiring", () => {
  it("inngest_serve_handler_returns_manifest_on_get", async () => {
    const { GET } = await import("@/app/api/inngest/route");
    const response = await GET(new NextRequest("http://localhost/api/inngest"), { params: Promise.resolve({}) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("functions");
    expect(Array.isArray(body.functions)).toBe(true);
  });

  it("inngest_route_exports_get_post_put", async () => {
    const route = await import("@/app/api/inngest/route");
    expect(typeof route.GET).toBe("function");
    expect(typeof route.POST).toBe("function");
    expect(typeof route.PUT).toBe("function");
  });

  it("inngest_functions_registry_exports_array", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions.length).toBeGreaterThanOrEqual(1);
  });

  it("next_config_transpiles_workflows_package", async () => {
    const mod = await import("@/next.config");
    const config = mod.default;
    expect(config.transpilePackages).toContain("@saas/workflows");
  });
});
