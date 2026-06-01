import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({}));

// ── Module mocks ──────────────────────────────────────────────────────────────

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
  customerInvitations: {},
  clients: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
}));

vi.mock("../email.service", () => ({
  sendCustomerInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({}) },
  })),
}));

vi.mock("@saas/config", () => ({
  env: {
    APP_URL: "http://localhost:3001",
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    RESEND_API_KEY: undefined,
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import { sendCustomerInvitationEmail } from "../email.service";

import {
  createInvitation,
  getInvitationByToken,
  consumeInvitation,
} from "../invitation.service";

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 25 * 60 * 60 * 1000);
const PAST_DATE = new Date(Date.now() - 60 * 60 * 1000);

const BASE_INVITATION = {
  id: "inv-uuid-1",
  clientId: "client-uuid-1",
  contactId: "contact-uuid-1",
  email: "contact@test.com",
  token: "a".repeat(64),
  invitedBy: "user-uuid-1",
  expiresAt: FUTURE_DATE,
  consumedAt: null,
  createdAt: new Date(),
};

const BASE_INPUT = {
  clientId: "client-uuid-1",
  contactId: "contact-uuid-1",
  email: "contact@test.com",
  invitedBy: "user-uuid-1",
};

function setupCreateInvitationMocks(overrides: {
  clientRow?: unknown;
  inviterRow?: unknown;
  insertedRow?: unknown;
} = {}) {
  const clientRow = overrides.clientRow ?? [{ name: "Acme Corp" }];
  const inviterRow = overrides.inviterRow ?? [{ name: "Alice" }];
  const insertedRow = overrides.insertedRow ?? [{
    id: BASE_INVITATION.id,
    token: BASE_INVITATION.token,
    expiresAt: FUTURE_DATE,
  }];

  dbMock.where
    .mockResolvedValueOnce(clientRow)
    .mockResolvedValueOnce(inviterRow);
  dbMock.returning.mockResolvedValueOnce(insertedRow);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("invitation.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
  });

  // ── createInvitation ─────────────────────────────────────────────────────────

  describe("createInvitation", () => {
    it("creates_invitation_with_valid_token_and_expiry", async () => {
      setupCreateInvitationMocks();

      const result = await createInvitation(BASE_INPUT);

      expect(result).toHaveProperty("id", BASE_INVITATION.id);
      expect(result.token).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(result.token)).toBe(true);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
      expect(result.expiresAt.getTime()).toBeLessThan(Date.now() + 25 * 60 * 60 * 1000);
    });

    it("deletes_unconsumed_invitations_before_insert", async () => {
      setupCreateInvitationMocks();

      await createInvitation(BASE_INPUT);

      expect(dbMock.delete).toHaveBeenCalledWith(
        expect.anything(),
      );
      expect(dbMock.where).toHaveBeenCalledWith(
        expect.objectContaining({ and: expect.any(Array) }),
      );
    });

    it("calls_send_customer_invitation_email", async () => {
      setupCreateInvitationMocks();

      await createInvitation(BASE_INPUT);

      expect(sendCustomerInvitationEmail).toHaveBeenCalledWith(
        "contact@test.com",
        expect.any(String),
        "Acme Corp",
        "Alice",
      );
    });

    it("persists_invitation_when_email_fails", async () => {
      setupCreateInvitationMocks();
      vi.mocked(sendCustomerInvitationEmail).mockRejectedValueOnce(
        new Error("SMTP failure"),
      );

      const result = await createInvitation(BASE_INPUT);

      expect(result).toHaveProperty("id", BASE_INVITATION.id);
      expect(dbMock.returning).toHaveBeenCalled();
    });

    it("throws_client_not_found_when_invalid_client_id", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      await expect(createInvitation(BASE_INPUT)).rejects.toThrow("CLIENT_NOT_FOUND");
    });
  });

  // ── getInvitationByToken ──────────────────────────────────────────────────────

  describe("getInvitationByToken", () => {
    it("returns_invitation_for_valid_token", async () => {
      dbMock.where.mockResolvedValueOnce([BASE_INVITATION]);

      const result = await getInvitationByToken(BASE_INVITATION.token);

      expect(result).toMatchObject({ id: BASE_INVITATION.id, token: BASE_INVITATION.token });
    });

    it("throws_invalid_token_when_not_found", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      await expect(getInvitationByToken("unknown-token")).rejects.toThrow("INVALID_TOKEN");
    });

    it("throws_token_expired_when_past_expiry", async () => {
      dbMock.where.mockResolvedValueOnce([{ ...BASE_INVITATION, expiresAt: PAST_DATE }]);

      await expect(getInvitationByToken(BASE_INVITATION.token)).rejects.toThrow("TOKEN_EXPIRED");
    });

    it("throws_token_already_consumed", async () => {
      dbMock.where.mockResolvedValueOnce([{ ...BASE_INVITATION, consumedAt: new Date() }]);

      await expect(getInvitationByToken(BASE_INVITATION.token)).rejects.toThrow(
        "TOKEN_ALREADY_CONSUMED",
      );
    });
  });

  // ── consumeInvitation ────────────────────────────────────────────────────────

  describe("consumeInvitation", () => {
    it("marks_consumed_at_and_returns_updated_invitation", async () => {
      const consumedAt = new Date();
      const updatedInvitation = { ...BASE_INVITATION, consumedAt };

      dbMock.where.mockResolvedValueOnce([BASE_INVITATION]);
      dbMock.returning.mockResolvedValueOnce([updatedInvitation]);

      const result = await consumeInvitation(BASE_INVITATION.token);

      expect(dbMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ consumedAt: expect.any(Date) }),
      );
      expect(result.consumedAt).not.toBeNull();
      expect(result).toMatchObject({ id: BASE_INVITATION.id });
    });

    it("consume_throws_already_consumed_on_repeat", async () => {
      dbMock.where.mockResolvedValueOnce([{ ...BASE_INVITATION, consumedAt: new Date() }]);

      await expect(consumeInvitation(BASE_INVITATION.token)).rejects.toThrow(
        "TOKEN_ALREADY_CONSUMED",
      );
    });

    it("consume_throws_token_already_consumed_on_cas_miss", async () => {
      dbMock.where.mockResolvedValueOnce([BASE_INVITATION]);
      dbMock.returning.mockResolvedValueOnce([]);

      await expect(consumeInvitation(BASE_INVITATION.token)).rejects.toThrow(
        "TOKEN_ALREADY_CONSUMED",
      );
    });
  });

  // ── sendCustomerInvitationEmail (direct) ──────────────────────────────────────

  describe("sendCustomerInvitationEmail", () => {
    it("sends_email_with_set_password_url", async () => {
      const { sendCustomerInvitationEmail: realSend } =
        await vi.importActual<typeof import("../email.service")>("../email.service");

      await realSend("user@test.com", "tok123", "Acme Corp", "Alice");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining("/set-password?token=tok123"),
        }),
      );
    });
  });
});
