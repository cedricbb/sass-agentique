import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
  totpChallenges: {},
}));

// vi.mock is hoisted — use vi.hoisted to define shared mock objects
const { mockAuthenticator } = vi.hoisted(() => ({
  mockAuthenticator: {
    generateSecret: vi.fn().mockReturnValue("BASE32SECRET"),
    keyuri: vi.fn().mockReturnValue("otpauth://totp/test"),
    verify: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("otplib", () => ({
  authenticator: mockAuthenticator,
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fake"),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockImplementation(async (val: string) => `hashed:${val}`),
    compare: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
}));

vi.mock("@saas/config", () => ({
  env: { TOTP_ISSUER: "Test App" },
}));

// ── Import après les mocks ────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import {
  generateTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
  verifyAndConsumeBackupCode,
  enableTotp,
  disableTotp,
  createTotpChallenge,
  consumeTotpChallenge,
  regenerateBackupCodes,
} from "../totp.service";

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("totp.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
    mockAuthenticator.verify.mockReturnValue(true);
  });

  // ── generateTotpSecret ────────────────────────────────────────────────────

  describe("generateTotpSecret", () => {
    it("retourne un secret et un qrDataUrl", async () => {
      const result = await generateTotpSecret("user@test.com");

      expect(result.secret).toBe("BASE32SECRET");
      expect(result.qrDataUrl).toBe("data:image/png;base64,fake");
      expect(mockAuthenticator.generateSecret).toHaveBeenCalled();
      expect(mockAuthenticator.keyuri).toHaveBeenCalledWith(
        "user@test.com",
        "Test App",
        "BASE32SECRET",
      );
    });

    it("utilise l'email fourni dans le keyuri", async () => {
      await generateTotpSecret("autre@example.com");
      expect(mockAuthenticator.keyuri).toHaveBeenCalledWith(
        "autre@example.com",
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ── verifyTotpCode ────────────────────────────────────────────────────────

  describe("verifyTotpCode", () => {
    it("retourne true pour un code valide", () => {
      mockAuthenticator.verify.mockReturnValue(true);
      expect(verifyTotpCode("SECRET", "123456")).toBe(true);
    });

    it("retourne false pour un code invalide", () => {
      mockAuthenticator.verify.mockReturnValue(false);
      expect(verifyTotpCode("SECRET", "000000")).toBe(false);
    });
  });

  // ── generateBackupCodes ───────────────────────────────────────────────────

  describe("generateBackupCodes", () => {
    it("génère 10 codes", () => {
      const codes = generateBackupCodes();
      expect(codes).toHaveLength(10);
    });

    it("chaque code est une chaîne hexadécimale de 10 caractères (5 bytes)", () => {
      const codes = generateBackupCodes();
      for (const code of codes) {
        expect(code).toMatch(/^[0-9a-f]{10}$/);
      }
    });

    it("les codes sont uniques", () => {
      const codes = generateBackupCodes();
      const unique = new Set(codes);
      expect(unique.size).toBe(10);
    });
  });

  // ── hashBackupCodes ───────────────────────────────────────────────────────

  describe("hashBackupCodes", () => {
    it("hache chaque code avec bcrypt", async () => {
      const codes = ["abc123", "def456"];
      const hashed = await hashBackupCodes(codes);

      expect(hashed).toHaveLength(2);
      expect(bcrypt.hash).toHaveBeenCalledTimes(2);
      expect(hashed[0]).toBe("hashed:abc123");
      expect(hashed[1]).toBe("hashed:def456");
    });
  });

  // ── verifyAndConsumeBackupCode ────────────────────────────────────────────

  describe("verifyAndConsumeBackupCode", () => {
    it("retourne false si l'utilisateur n'a pas de backup codes", async () => {
      dbMock.where.mockResolvedValue([{ backupCodes: null }]);

      const result = await verifyAndConsumeBackupCode("u1", "badcode");
      expect(result).toBe(false);
    });

    it("retourne false si aucun code ne correspond", async () => {
      dbMock.where.mockResolvedValue([{ backupCodes: ["hashed:code1", "hashed:code2"] }]);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const result = await verifyAndConsumeBackupCode("u1", "wrong");
      expect(result).toBe(false);
    });

    it("retourne true et retire le code utilisé", async () => {
      dbMock.where
        .mockResolvedValueOnce([{ backupCodes: ["hashed:abc", "hashed:def"] }])
        .mockResolvedValue(undefined);
      vi.mocked(bcrypt.compare)
        .mockResolvedValueOnce(false as never)   // hashed:abc ne correspond pas
        .mockResolvedValueOnce(true as never);   // hashed:def correspond

      const result = await verifyAndConsumeBackupCode("u1", "def");
      expect(result).toBe(true);
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodes: ["hashed:abc"] }),
      );
    });
  });

  // ── enableTotp ────────────────────────────────────────────────────────────

  describe("enableTotp", () => {
    it("lève INVALID_TOTP_CODE si le code TOTP est invalide", async () => {
      mockAuthenticator.verify.mockReturnValue(false);

      await expect(enableTotp("u1", "SECRET", "000000")).rejects.toThrow(
        "INVALID_TOTP_CODE",
      );
    });

    it("sauvegarde le secret et retourne les plain backup codes", async () => {
      mockAuthenticator.verify.mockReturnValue(true);
      dbMock.where.mockResolvedValue(undefined);

      const result = await enableTotp("u1", "MYSECRET", "123456");

      expect(result.backupCodes).toHaveLength(10);
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          totpSecret: "MYSECRET",
          totpEnabled: true,
        }),
      );
    });
  });

  // ── disableTotp ───────────────────────────────────────────────────────────

  describe("disableTotp", () => {
    it("lève TOTP_NOT_ENABLED si le TOTP n'est pas activé pour l'utilisateur", async () => {
      dbMock.where.mockResolvedValue([]);

      await expect(disableTotp("u1", "123456")).rejects.toThrow("TOTP_NOT_ENABLED");
    });

    it("désactive le TOTP avec un code TOTP valide", async () => {
      dbMock.where
        .mockResolvedValueOnce([{ totpSecret: "SECRET" }]) // select user
        .mockResolvedValue(undefined); // update
      mockAuthenticator.verify.mockReturnValue(true);

      await expect(disableTotp("u1", "123456")).resolves.toBeUndefined();
      expect(dbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({
          totpEnabled: false,
          totpSecret: null,
          backupCodes: null,
        }),
      );
    });

    it("désactive le TOTP avec un backup code valide", async () => {
      dbMock.where
        .mockResolvedValueOnce([{ totpSecret: "SECRET" }]) // select user for disable
        .mockResolvedValueOnce([{ backupCodes: ["hashed:backup"] }]) // select user for backup verify
        .mockResolvedValue(undefined); // updates
      mockAuthenticator.verify.mockReturnValue(false); // TOTP invalide
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never); // backup code valide

      await expect(disableTotp("u1", "backup")).resolves.toBeUndefined();
    });

    it("lève INVALID_CODE si ni TOTP ni backup code ne fonctionnent", async () => {
      dbMock.where
        .mockResolvedValueOnce([{ totpSecret: "SECRET" }])
        .mockResolvedValueOnce([{ backupCodes: ["hashed:other"] }])
        .mockResolvedValue(undefined);
      mockAuthenticator.verify.mockReturnValue(false);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(disableTotp("u1", "wrong")).rejects.toThrow("INVALID_CODE");
    });
  });

  // ── createTotpChallenge ───────────────────────────────────────────────────

  describe("createTotpChallenge", () => {
    it("insère un challenge en DB et retourne un token", async () => {
      dbMock.values.mockResolvedValue(undefined);

      const token = await createTotpChallenge("u1");

      expect(token).toMatch(/^[0-9a-f]{64}$/);
      expect(dbMock.insert).toHaveBeenCalled();
      expect(dbMock.values).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", token }),
      );
    });

    it("le token expire dans 15 minutes", async () => {
      dbMock.values.mockResolvedValue(undefined);
      const before = new Date();

      await createTotpChallenge("u1");

      const valuesCall = dbMock.values.mock.calls[0][0];
      const diff = (valuesCall.expiresAt as Date).getTime() - before.getTime();
      expect(diff).toBeGreaterThanOrEqual(14 * 60 * 1000);
      expect(diff).toBeLessThanOrEqual(16 * 60 * 1000);
    });
  });

  // ── consumeTotpChallenge ──────────────────────────────────────────────────

  describe("consumeTotpChallenge", () => {
    it("lève CHALLENGE_NOT_FOUND si le token est inconnu", async () => {
      dbMock.where.mockResolvedValue([]);

      await expect(consumeTotpChallenge("bad-token", "123456")).rejects.toThrow(
        "CHALLENGE_NOT_FOUND",
      );
    });

    it("lève CHALLENGE_EXPIRED si le challenge est expiré", async () => {
      dbMock.where
        .mockResolvedValueOnce([{
          id: "c1",
          userId: "u1",
          expiresAt: new Date(Date.now() - 1000),
        }])
        .mockResolvedValue(undefined); // delete

      await expect(consumeTotpChallenge("expired-token", "123456")).rejects.toThrow(
        "CHALLENGE_EXPIRED",
      );
      expect(dbMock.delete).toHaveBeenCalled();
    });

    it("lève INVALID_TOTP_CODE si le code TOTP est invalide", async () => {
      dbMock.where
        .mockResolvedValueOnce([{
          id: "c1",
          userId: "u1",
          expiresAt: new Date(Date.now() + 600_000),
        }])
        .mockResolvedValueOnce([{ totpSecret: "SECRET" }]) // user
        .mockResolvedValueOnce([{ backupCodes: [] }]);     // backup code check
      mockAuthenticator.verify.mockReturnValue(false);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(consumeTotpChallenge("valid-token", "000000")).rejects.toThrow(
        "INVALID_TOTP_CODE",
      );
    });

    it("crée une session et retourne sessionToken + userId + tenantSlug vide sur succès TOTP", async () => {
      dbMock.where
        .mockResolvedValueOnce([{
          id: "c1",
          userId: "u1",
          expiresAt: new Date(Date.now() + 600_000),
        }])
        .mockResolvedValueOnce([{ totpSecret: "SECRET" }]) // user
        .mockResolvedValue(undefined); // delete challenge + session insert
      mockAuthenticator.verify.mockReturnValue(true);

      const result = await consumeTotpChallenge("valid-token", "123456");

      expect(result).toHaveProperty("sessionToken");
      expect(result.userId).toBe("u1");
      expect(result.tenantSlug).toBe("");
    });
  });

  // ── regenerateBackupCodes ─────────────────────────────────────────────────

  describe("regenerateBackupCodes", () => {
    it("génère 10 nouveaux codes et met à jour la DB", async () => {
      dbMock.where.mockResolvedValue(undefined);

      const codes = await regenerateBackupCodes("u1");

      expect(codes).toHaveLength(10);
      expect(dbMock.update).toHaveBeenCalled();
      expect(dbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ backupCodes: expect.any(Array) }),
      );
    });
  });
});
