import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn().mockImplementation(() => {
  throw new Error("NEXT_REDIRECT");
});

const mockValidateSession = vi.fn();

const mockGet = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ get: mockGet });

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@saas/services", () => ({ validateSession: mockValidateSession }));

const ADMIN_USER = {
  id: "1",
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
  emailVerified: true,
};

const CLIENT_USER = {
  id: "2",
  email: "client@test.com",
  name: "Client",
  role: "client",
  emailVerified: true,
};

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects to /login when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    const { requireAdmin } = await import("../auth");

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(mockValidateSession).not.toHaveBeenCalled();
  });

  it("redirects to /login when session token is invalid", async () => {
    mockGet.mockReturnValue({ value: "invalid-token" });
    mockValidateSession.mockResolvedValue(null);
    const { requireAdmin } = await import("../auth");

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to / when user role is not admin", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    const { requireAdmin } = await import("../auth");

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("returns admin user when session is valid and role is admin", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(ADMIN_USER);
    const { requireAdmin } = await import("../auth");

    const user = await requireAdmin();
    expect(user).toEqual(ADMIN_USER);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("returns null when no cookie is present", async () => {
    mockGet.mockReturnValue(undefined);
    const { getSession } = await import("../auth");

    const result = await getSession();
    expect(result).toBeNull();
    expect(mockValidateSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("returns user when session is valid", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    const { getSession } = await import("../auth");

    const result = await getSession();
    expect(result).toEqual(CLIENT_USER);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
