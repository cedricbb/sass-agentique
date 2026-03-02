import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "from",
    "where",
    "innerJoin",
    "insert",
    "values",
    "returning",
    "update",
    "set",
    "delete",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() {
    return dbMock;
  },
  invitations: {},
  tenants: {},
  memberships: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock("../email.service", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../membership.service", () => ({
  getMembershipByUser: vi.fn().mockResolvedValue(null),
  addMember: vi.fn().mockResolvedValue({
    id: "m1",
    userId: "u1",
    tenantId: "t1",
    role: "MEMBER",
    createdAt: new Date(),
  }),
}));

vi.mock("../tenant.service", () => ({
  getTenantById: vi.fn().mockResolvedValue({
    id: "t1",
    slug: "my-tenant",
    name: "My Tenant",
    plan: "free",
    createdAt: new Date(),
  }),
}));

import { sendInvitationEmail } from "../email.service";
import { getMembershipByUser, addMember } from "../membership.service";
import {
  inviteMember,
  acceptInvitation,
  cancelInvitation,
  getInvitationsByTenant,
} from "../invitation.service";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("invitation.service", () => {
  beforeEach(() => {
    dbMock = makeDrizzleMock();
    vi.clearAllMocks();
    // Remettre les mocks par défaut
    vi.mocked(getMembershipByUser).mockResolvedValue(null);
    vi.mocked(addMember).mockResolvedValue({
      id: "m1",
      userId: "u1",
      tenantId: "t1",
      role: "MEMBER",
      createdAt: new Date(),
    });
  });

  // ── inviteMember ──────────────────────────────────────────────────────────

  describe("inviteMember", () => {
    it("lève ALREADY_MEMBER si l'utilisateur est déjà membre", async () => {
      // L'user avec cet email existe
      dbMock.where.mockResolvedValueOnce([{ id: "existing-user" }]);
      // Et est déjà membre
      vi.mocked(getMembershipByUser).mockResolvedValueOnce({
        id: "m1",
        userId: "existing-user",
        tenantId: "t1",
        role: "MEMBER",
        createdAt: new Date(),
      });

      await expect(
        inviteMember({
          tenantId: "t1",
          invitedBy: "owner-u1",
          email: "already@member.com",
        }),
      ).rejects.toThrow("ALREADY_MEMBER");
    });

    it("lève INVITATION_ALREADY_SENT si une invitation PENDING existe", async () => {
      // User pas encore dans le système
      dbMock.where.mockResolvedValueOnce([]); // no existing user
      // Mais une invitation PENDING existe
      dbMock.where.mockResolvedValueOnce([{ id: "existing-invitation" }]);

      await expect(
        inviteMember({
          tenantId: "t1",
          invitedBy: "owner-u1",
          email: "pending@invite.com",
        }),
      ).rejects.toThrow("INVITATION_ALREADY_SENT");
    });

    it("crée l'invitation et envoie l'email", async () => {
      // User inexistant
      dbMock.where.mockResolvedValueOnce([]);
      // Pas d'invitation PENDING
      dbMock.where.mockResolvedValueOnce([]);
      // Insert invitation
      dbMock.returning.mockResolvedValueOnce([
        {
          id: "inv1",
          tenantId: "t1",
          email: "new@invite.com",
          role: "MEMBER",
          token: "abc123",
          status: "PENDING",
          invitedBy: "owner-u1",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: new Date(),
        },
      ]);

      const result = await inviteMember({
        tenantId: "t1",
        invitedBy: "owner-u1",
        email: "new@invite.com",
      });

      expect(result).toHaveProperty("id", "inv1");
      expect(sendInvitationEmail).toHaveBeenCalledWith(
        "new@invite.com",
        expect.any(String),
        "My Tenant",
      );
    });
  });

  // ── acceptInvitation ──────────────────────────────────────────────────────

  describe("acceptInvitation", () => {
    it("lève INVALID_TOKEN si l'invitation n'existe pas", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      await expect(
        acceptInvitation({ token: "invalid-token", userId: "u1" }),
      ).rejects.toThrow("INVALID_TOKEN");
    });

    it("lève TOKEN_EXPIRED si l'invitation est expirée", async () => {
      dbMock.where.mockResolvedValueOnce([
        {
          id: "inv1",
          tenantId: "t1",
          role: "MEMBER",
          status: "PENDING",
          expiresAt: new Date(Date.now() - 1000), // expirée
        },
      ]);

      await expect(
        acceptInvitation({ token: "expired-token", userId: "u1" }),
      ).rejects.toThrow("TOKEN_EXPIRED");
    });

    it("lève INVITATION_NOT_PENDING si l'invitation n'est pas en attente", async () => {
      dbMock.where.mockResolvedValueOnce([
        {
          id: "inv1",
          tenantId: "t1",
          role: "MEMBER",
          status: "ACCEPTED", // déjà acceptée
          expiresAt: new Date(Date.now() + 1_000_000),
        },
      ]);

      await expect(
        acceptInvitation({ token: "used-token", userId: "u1" }),
      ).rejects.toThrow("INVITATION_NOT_PENDING");
    });

    it("accepte l'invitation et retourne le tenantSlug", async () => {
      dbMock.where.mockResolvedValueOnce([
        {
          id: "inv1",
          tenantId: "t1",
          role: "MEMBER",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 1_000_000),
        },
      ]);
      // update invitation status
      dbMock.where.mockResolvedValueOnce(undefined);

      const result = await acceptInvitation({ token: "valid-token", userId: "u2" });

      expect(result).toHaveProperty("tenantSlug", "my-tenant");
      expect(addMember).toHaveBeenCalledWith({
        userId: "u2",
        tenantId: "t1",
        role: "MEMBER",
      });
    });
  });

  // ── cancelInvitation ──────────────────────────────────────────────────────

  describe("cancelInvitation", () => {
    it("lève FORBIDDEN si l'invitation appartient à un autre tenant (isolation)", async () => {
      dbMock.where.mockResolvedValueOnce([
        { id: "inv1", tenantId: "tenant-B" },
      ]);

      await expect(
        cancelInvitation("inv1", "tenant-A"),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("lève FORBIDDEN si l'invitation n'existe pas", async () => {
      dbMock.where.mockResolvedValueOnce([]);

      await expect(
        cancelInvitation("inv-unknown", "t1"),
      ).rejects.toThrow("FORBIDDEN");
    });

    it("annule l'invitation avec succès", async () => {
      dbMock.where.mockResolvedValueOnce([{ id: "inv1", tenantId: "t1" }]);
      dbMock.where.mockResolvedValueOnce(undefined); // update

      await expect(cancelInvitation("inv1", "t1")).resolves.toBeUndefined();
      expect(dbMock.update).toHaveBeenCalled();
    });
  });

  // ── getInvitationsByTenant ────────────────────────────────────────────────

  describe("getInvitationsByTenant", () => {
    it("retourne les invitations du tenant", async () => {
      const mockInvitations = [
        {
          id: "inv1",
          tenantId: "t1",
          email: "a@test.com",
          role: "MEMBER",
          token: "tok1",
          status: "PENDING",
          invitedBy: "owner",
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ];
      dbMock.where.mockResolvedValueOnce(mockInvitations);

      const result = await getInvitationsByTenant("t1");
      expect(result).toHaveLength(1);
    });
  });
});
