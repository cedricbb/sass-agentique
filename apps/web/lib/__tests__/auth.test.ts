import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn().mockImplementation(() => {
  throw new Error("NEXT_REDIRECT");
});

const mockValidateSession = vi.fn();
const mockGetPrimaryClientForUser = vi.fn();

const mockGet = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({ get: mockGet });

const mockNotFound = vi.fn().mockImplementation(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect, notFound: mockNotFound }));
vi.mock("@saas/services", () => ({
  validateSession: mockValidateSession,
  getPrimaryClientForUser: mockGetPrimaryClientForUser,
}));

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

const MOCK_CLIENT = { id: "client-1", name: "Acme", slug: "acme", archivedAt: null, clientId: "client-1" };

describe("requireCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects to /login when no session", async () => {
    mockGet.mockReturnValue(undefined);
    const { requireCustomer } = await import("../auth");
    await expect(requireCustomer()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /admin when user role is admin", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(ADMIN_USER);
    const { requireCustomer } = await import("../auth");
    await expect(requireCustomer()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });

  it("redirects to /customer/no-client when client user has no linked client", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    mockGetPrimaryClientForUser.mockResolvedValue(null);
    const { requireCustomer } = await import("../auth");
    await expect(requireCustomer()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/customer/no-client");
  });

  it("returns {user, client} when client user has linked client", async () => {
    mockGet.mockReturnValue({ value: "valid-token" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    mockGetPrimaryClientForUser.mockResolvedValue(MOCK_CLIENT);
    const { requireCustomer } = await import("../auth");
    const scope = await requireCustomer();
    expect(scope).toEqual({ user: CLIENT_USER, client: MOCK_CLIENT });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("assertClientOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotFound.mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  const SCOPE = { user: CLIENT_USER, client: { id: "client-1" } } as any;

  it("returns entity when clientId matches scope", async () => {
    const { assertClientOwnership } = await import("../auth");
    const entity = { clientId: "client-1", name: "test" };
    const result = assertClientOwnership(entity, SCOPE);
    expect(result).toEqual(entity);
  });

  it("calls notFound when entity is null", async () => {
    const { assertClientOwnership } = await import("../auth");
    expect(() => assertClientOwnership(null, SCOPE)).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });

  it("calls notFound when clientId does not match", async () => {
    const { assertClientOwnership } = await import("../auth");
    const entity = { clientId: "other-client", name: "test" };
    expect(() => assertClientOwnership(entity, SCOPE)).toThrow("NEXT_NOT_FOUND");
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("assertClientOwnershipOrThrow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const SCOPE = { user: CLIENT_USER, client: { id: "client-1" } } as any;

  it("returns entity when clientId matches scope", async () => {
    const { assertClientOwnershipOrThrow } = await import("../auth");
    const entity = { clientId: "client-1", name: "test" };
    const result = assertClientOwnershipOrThrow(entity, SCOPE);
    expect(result).toEqual(entity);
  });

  it("throws ForbiddenScopeError when entity is null", async () => {
    const { assertClientOwnershipOrThrow } = await import("../auth");
    expect(() => assertClientOwnershipOrThrow(null, SCOPE)).toThrow("Ressource introuvable.");
  });

  it("throws ForbiddenScopeError when clientId does not match", async () => {
    const { assertClientOwnershipOrThrow } = await import("../auth");
    const entity = { clientId: "other-client", name: "test" };
    expect(() => assertClientOwnershipOrThrow(entity, SCOPE)).toThrow("Ressource introuvable.");
  });
});
