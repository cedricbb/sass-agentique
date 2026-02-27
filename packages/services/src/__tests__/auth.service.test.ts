import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock chaînable pour Drizzle : chaque méthode retourne `this` sauf le terminal
const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "innerJoin",
    "insert", "values", "returning",
    "update", "set",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  users: {},
  sessions: {},
  emailVerifications: {},
  passwordResets: {},
}));

vi.mock("../email.service", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
}));

// ── Import après les mocks ────────────────────────────────────────────────────

import { sendVerificationEmail, sendPasswordResetEmail } from "../email.service";
import bcrypt from "bcryptjs";
import {
  register,
  login,
  logout,
  validateSession,
  verifyEmail,
  forgotPassword,
  resetPassword,
} from "../auth.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Configure le mock pour que `where()` et `returning()` résolvent avec `result`. */
function mockDbReturns(result: unknown) {
  dbMock.where.mockResolvedValue(result);
  dbMock.returning.mockResolvedValue(result);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("auth.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  // ── register ─────────────────────────────────────────────────────────────────

  describe("register", () => {
    it("lève EMAIL_ALREADY_EXISTS si l'email est déjà pris", async () => {
      mockDbReturns([{ id: "existing-id" }]);

      await expect(
        register({ email: "taken@test.com", password: "password123" }),
      ).rejects.toThrow("EMAIL_ALREADY_EXISTS");
    });

    it("crée l'utilisateur, envoie l'email de vérification et retourne un sessionToken", async () => {
      const mockUser = { id: "user-1", email: "new@test.com" };
      // 1ère query : check email existant → vide
      // Check email existant → vide
      dbMock.where.mockResolvedValueOnce([]);
      // insert user → .returning() résout avec mockUser
      // values() garde mockReturnThis pour permettre le chaînage avec .returning()
      dbMock.returning.mockResolvedValueOnce([mockUser]);
      // Les inserts emailVerification + session utilisent .values() sans .returning()
      // → await dbMock (non-thenable) résout immédiatement — pas besoin de mock supplémentaire

      const result = await register({ email: "new@test.com", password: "password123" });

      expect(result).toHaveProperty("sessionToken");
      expect(result).toHaveProperty("userId", "user-1");
      expect(sendVerificationEmail).toHaveBeenCalledWith("new@test.com", expect.any(String));
    });

    it("normalise l'email en lowercase", async () => {
      dbMock.where.mockResolvedValueOnce([]);
      dbMock.returning.mockResolvedValueOnce([{ id: "u1", email: "user@test.com" }]);

      await register({ email: "USER@TEST.COM", password: "password123" });

      expect(sendVerificationEmail).toHaveBeenCalledWith("user@test.com", expect.any(String));
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("lève INVALID_CREDENTIALS si l'utilisateur n'existe pas", async () => {
      mockDbReturns([]);

      await expect(
        login({ email: "nobody@test.com", password: "pass" }),
      ).rejects.toThrow("INVALID_CREDENTIALS");
    });

    it("lève INVALID_CREDENTIALS si le mot de passe est faux", async () => {
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
      mockDbReturns([{ id: "u1", hashedPassword: "hashed" }]);

      await expect(
        login({ email: "user@test.com", password: "wrong" }),
      ).rejects.toThrow("INVALID_CREDENTIALS");
    });

    it("retourne sessionToken + userId sur credentials valides", async () => {
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
      dbMock.where.mockResolvedValueOnce([{ id: "u1", hashedPassword: "hashed" }]);

      const result = await login({ email: "user@test.com", password: "good" });

      expect(result).toHaveProperty("sessionToken");
      expect(result.userId).toBe("u1");
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("supprime la session sans erreur", async () => {
      dbMock.where.mockResolvedValue(undefined);

      await expect(logout("some-session-token")).resolves.toBeUndefined();
      expect(dbMock.delete).toHaveBeenCalled();
    });
  });

  // ── validateSession ───────────────────────────────────────────────────────────

  describe("validateSession", () => {
    it("retourne null si la session n'existe pas", async () => {
      mockDbReturns([]);

      expect(await validateSession("unknown")).toBeNull();
    });

    it("retourne null et supprime une session expirée", async () => {
      mockDbReturns([{
        userId: "u1",
        expires: new Date(Date.now() - 1000),
        email: "u@t.com",
        name: null,
        role: "user",
      }]);

      expect(await validateSession("expired")).toBeNull();
      expect(dbMock.delete).toHaveBeenCalled();
    });

    it("retourne l'utilisateur si la session est valide", async () => {
      mockDbReturns([{
        userId: "u1",
        expires: new Date(Date.now() + 1_000_000),
        email: "u@t.com",
        name: "Jean",
        role: "user",
      }]);

      const user = await validateSession("valid-token");

      expect(user).not.toBeNull();
      expect(user?.id).toBe("u1");
      expect(user?.email).toBe("u@t.com");
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────────

  describe("verifyEmail", () => {
    it("lève INVALID_TOKEN si le token est inconnu", async () => {
      mockDbReturns([]);

      await expect(verifyEmail("bad-token")).rejects.toThrow("INVALID_TOKEN");
    });

    it("lève TOKEN_EXPIRED si le token est expiré", async () => {
      mockDbReturns([{
        id: "v1",
        userId: "u1",
        expiresAt: new Date(Date.now() - 1000),
      }]);

      await expect(verifyEmail("expired")).rejects.toThrow("TOKEN_EXPIRED");
    });

    it("supprime le token sur succès", async () => {
      dbMock.where.mockResolvedValueOnce([{
        id: "v1",
        userId: "u1",
        expiresAt: new Date(Date.now() + 1_000_000),
      }]);
      dbMock.where.mockResolvedValueOnce(undefined); // delete

      await expect(verifyEmail("valid")).resolves.toBeUndefined();
      expect(dbMock.delete).toHaveBeenCalled();
    });
  });

  // ── forgotPassword ────────────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("ne fait rien si l'email n'existe pas (sécurité)", async () => {
      mockDbReturns([]);

      await expect(forgotPassword("ghost@test.com")).resolves.toBeUndefined();
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("envoie l'email de reset si l'utilisateur existe", async () => {
      dbMock.where.mockResolvedValueOnce([{ id: "u1", email: "user@test.com" }]);
      dbMock.where.mockResolvedValueOnce(undefined); // delete old resets

      await forgotPassword("user@test.com");

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        "user@test.com",
        expect.any(String),
      );
    });
  });

  // ── resetPassword ─────────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("lève INVALID_TOKEN si le token est inconnu", async () => {
      mockDbReturns([]);

      await expect(resetPassword("bad", "newpass123")).rejects.toThrow("INVALID_TOKEN");
    });

    it("lève TOKEN_EXPIRED si le token est expiré", async () => {
      mockDbReturns([{
        id: "r1",
        userId: "u1",
        expiresAt: new Date(Date.now() - 1000),
      }]);

      await expect(resetPassword("expired", "newpass123")).rejects.toThrow("TOKEN_EXPIRED");
    });

    it("met à jour le mot de passe et invalide les sessions", async () => {
      dbMock.where.mockResolvedValueOnce([{
        id: "r1",
        userId: "u1",
        expiresAt: new Date(Date.now() + 1_000_000),
      }]);
      // update user password
      dbMock.where.mockResolvedValueOnce(undefined);
      // delete password reset
      dbMock.where.mockResolvedValueOnce(undefined);
      // delete sessions
      dbMock.where.mockResolvedValueOnce(undefined);

      await expect(resetPassword("valid-token", "newpassword123")).resolves.toBeUndefined();
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.delete).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword123", 12);
    });
  });
});
