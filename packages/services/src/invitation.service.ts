import { eq, and, isNull } from "drizzle-orm";
import { db } from "@saas/db";
import { customerInvitations, clients, users } from "@saas/db";
import type { CustomerInvitation } from "@saas/db";
import { randomBytes } from "crypto";
import { sendCustomerInvitationEmail } from "./email.service";

const INVITATION_TTL_HOURS = 24;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export type CreateInvitationInput = {
  clientId: string;
  contactId: string;
  email: string;
  invitedBy: string;
};

export type CreateInvitationResult = {
  id: string;
  token: string;
  expiresAt: Date;
};

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const { clientId, contactId, email, invitedBy } = input;

  const [clientRow] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId));

  if (!clientRow) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const [inviterRow] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, invitedBy));

  await db
    .delete(customerInvitations)
    .where(
      and(
        eq(customerInvitations.contactId, contactId),
        isNull(customerInvitations.consumedAt),
      ),
    );

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + INVITATION_TTL_HOURS);

  const [invitation] = await db
    .insert(customerInvitations)
    .values({ clientId, contactId, email, token, invitedBy, expiresAt })
    .returning({
      id: customerInvitations.id,
      token: customerInvitations.token,
      expiresAt: customerInvitations.expiresAt,
    });

  try {
    await sendCustomerInvitationEmail(
      email,
      token,
      clientRow.name,
      inviterRow?.name ?? undefined,
    );
  } catch (err) {
    console.error("[invitation.service] sendCustomerInvitationEmail failed:", err);
  }

  return { id: invitation.id, token: invitation.token, expiresAt: invitation.expiresAt };
}

export async function getInvitationByToken(
  token: string,
): Promise<CustomerInvitation> {
  const now = new Date();

  const [invitation] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.token, token));

  if (!invitation) {
    throw new Error("INVALID_TOKEN");
  }

  if (invitation.consumedAt !== null) {
    throw new Error("TOKEN_ALREADY_CONSUMED");
  }

  if (invitation.expiresAt < now) {
    throw new Error("TOKEN_EXPIRED");
  }

  return invitation;
}

export async function consumeInvitation(
  token: string,
): Promise<CustomerInvitation> {
  const invitation = await getInvitationByToken(token);
  const now = new Date();

  const [updated] = await db
    .update(customerInvitations)
    .set({ consumedAt: now })
    .where(and(eq(customerInvitations.id, invitation.id), isNull(customerInvitations.consumedAt)))
    .returning();

  if (!updated) {
    throw new Error("TOKEN_ALREADY_CONSUMED");
  }

  return updated;
}
