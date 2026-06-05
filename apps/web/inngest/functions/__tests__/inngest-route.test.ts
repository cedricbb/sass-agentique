import { describe, it, expect, vi } from "vitest";

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
  inngest: { id: "saas-agentique" },
}));

describe("Inngest runtime wiring", () => {
  it("inngest_serve_handler_returns_manifest_on_get", async () => {
    const { GET } = await import("@/app/api/inngest/route");
    const response = await GET(new Request("http://localhost/api/inngest"));
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

  it("inngest_functions_registry_exports_empty_array", async () => {
    const { inngestFunctions } = await import("@/inngest/functions/index");
    expect(Array.isArray(inngestFunctions)).toBe(true);
    expect(inngestFunctions).toHaveLength(0);
  });

  it("next_config_transpiles_workflows_package", async () => {
    const mod = await import("@/next.config");
    const config = mod.default;
    expect(config.transpilePackages).toContain("@saas/workflows");
  });
});
