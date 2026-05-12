import {
  db,
  clients,
  clientContacts,
  type Client,
  type NewClient,
  type ClientContact,
  type NewClientContact,
} from "@saas/db";
import { eq, and, isNull } from "drizzle-orm";
import { generateSlug } from "./utils/slug";

export type ListClientsOptions = { includeArchived?: boolean };
export type CreateClientInput = Omit<NewClient, "slug"> & { slug?: string };
export type UpdateClientPatch = Partial<NewClient>;
export type AddContactOptions = { isPrimary?: boolean; role?: string };
export type UpdateContactPatch = Partial<NewClientContact>;

export async function listClients(
  opts?: ListClientsOptions,
): Promise<Client[]> {
  return db
    .select()
    .from(clients)
    .where(opts?.includeArchived ? undefined : isNull(clients.archivedAt));
}

export async function getClientById(id: string): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);
  return row ?? null;
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(eq(clients.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const slug = input.slug ?? generateSlug(input.name);
  const [row] = await db
    .insert(clients)
    .values({ ...input, slug })
    .returning();
  return row;
}

export async function updateClient(
  id: string,
  patch: UpdateClientPatch,
): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return row ?? null;
}

export async function archiveClient(id: string): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return row ?? null;
}

export async function unarchiveClient(id: string): Promise<Client | null> {
  const [row] = await db
    .update(clients)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();
  return row ?? null;
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
}

export async function listClientContacts(
  clientId: string,
): Promise<ClientContact[]> {
  return db
    .select()
    .from(clientContacts)
    .where(eq(clientContacts.clientId, clientId));
}

export async function addClientContact(
  clientId: string,
  userId: string,
  opts?: AddContactOptions,
): Promise<ClientContact> {
  const [row] = await db
    .insert(clientContacts)
    .values({
      clientId,
      userId,
      isPrimary: opts?.isPrimary ?? false,
      role: opts?.role,
    })
    .returning();
  return row;
}

export async function updateClientContact(
  id: string,
  patch: UpdateContactPatch,
): Promise<ClientContact | null> {
  const [row] = await db
    .update(clientContacts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(clientContacts.id, id))
    .returning();
  return row ?? null;
}

export async function removeClientContact(
  clientId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(clientContacts)
    .where(
      and(
        eq(clientContacts.clientId, clientId),
        eq(clientContacts.userId, userId),
      ),
    );
}

export async function setPrimaryContact(
  clientId: string,
  userId: string,
): Promise<ClientContact | null> {
  return db.transaction(async (tx) => {
    await tx
      .update(clientContacts)
      .set({ isPrimary: false })
      .where(eq(clientContacts.clientId, clientId));
    const [updated] = await tx
      .update(clientContacts)
      .set({ isPrimary: true })
      .where(
        and(
          eq(clientContacts.clientId, clientId),
          eq(clientContacts.userId, userId),
        ),
      )
      .returning();
    return updated ?? null;
  });
}
