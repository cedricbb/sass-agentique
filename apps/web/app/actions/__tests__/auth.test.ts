import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn().mockImplementation(() => {
  throw new Error("NEXT_REDIRECT");
});

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockValidateSession = vi.fn();
const mockConsumeTotpChallenge = vi.fn();

const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
const mockCookies = vi.fn().mockResolvedValue({
  set: mockCookieSet,
  get: mockCookieGet,
  delete: mockCookieDelete,
});

vi.mock("next/headers", () => ({ cookies: mockCookies }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@saas/services", () => ({
  register: mockRegister,
  login: mockLogin,
  validateSession: mockValidateSession,
  consumeTotpChallenge: mockConsumeTotpChallenge,
}));

const CLIENT_USER = { id: "2", email: "client@test.com", name: "Client", role: "client", emailVerified: true };
const ADMIN_USER = { id: "1", email: "admin@test.com", name: "Admin", role: "admin", emailVerified: true };

describe("registerAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("register_redirects_to_account", async () => {
    mockRegister.mockResolvedValue({ sessionToken: "session-tok" });
    const { registerAction } = await import("../auth");
    const fd = new FormData();
    fd.set("email", "new@test.com");
    fd.set("password", "password123");
    await expect(registerAction(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/account/");
  });
});

describe("loginAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("login_redirects_customer_to_account", async () => {
    mockLogin.mockResolvedValue({ requiresTotp: false, sessionToken: "session-tok" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    const { loginAction } = await import("../auth");
    const fd = new FormData();
    fd.set("email", "client@test.com");
    fd.set("password", "password123");
    await expect(loginAction(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/account/");
  });

  it("login_redirects_admin_to_admin", async () => {
    mockLogin.mockResolvedValue({ requiresTotp: false, sessionToken: "session-tok" });
    mockValidateSession.mockResolvedValue(ADMIN_USER);
    const { loginAction } = await import("../auth");
    const fd = new FormData();
    fd.set("email", "admin@test.com");
    fd.set("password", "password123");
    await expect(loginAction(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/admin/");
  });

  it("login_respects_next_param", async () => {
    mockLogin.mockResolvedValue({ requiresTotp: false, sessionToken: "session-tok" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    const { loginAction } = await import("../auth");
    const fd = new FormData();
    fd.set("email", "client@test.com");
    fd.set("password", "password123");
    fd.set("next", "/account/quotes");
    await expect(loginAction(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/account/quotes");
  });
});

describe("totpVerifyAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("totp_verify_redirects_customer_to_account", async () => {
    mockCookieGet.mockReturnValue({ value: "challenge-tok" });
    mockConsumeTotpChallenge.mockResolvedValue({ sessionToken: "session-tok" });
    mockValidateSession.mockResolvedValue(CLIENT_USER);
    const { totpVerifyAction } = await import("../auth");
    const fd = new FormData();
    fd.set("code", "123456");
    await expect(totpVerifyAction(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/account/");
  });
});
