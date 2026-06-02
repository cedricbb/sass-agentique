import {
  db,
  clients,
  clientContacts,
  maintenanceContracts,
  users,
  type Client,
  type NewClient,
  type ClientContact,
  type NewClientContact,
} from "@saas/db";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { generateSlug } from "./utils/slug";

export type ListClientsOptions = { includeArchived?: boolean };
export type CreateClientInput = Omit<NewClient, "slug"> & { slug?: string };
export type UpdateClientPatch = Partial<NewClient>;
export type AddContactInput = {
  clientId: string;
  name: string;
  email: string;
  userId?: string | null;
  isPrimary?: boolean;
  role?: string | null;
};
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
  await db.transaction(async (tx) => {
    await tx.delete(maintenanceContracts).where(eq(maintenanceContracts.clientId, id));
    await tx.delete(clients).where(eq(clients.id, id));
  });
}

export type ContactWithUser = {
  contact: ClientContact;
  user: { id: string; email: string; name: string | null };
};

export async function getClientContactWithUser(
  contactId: string,
): Promise<ContactWithUser | null> {
  const [row] = await db
    .select({
      contact: clientContacts,
      userId: users.id,
      userEmail: users.email,
      userName: users.name,
    })
    .from(clientContacts)
    .innerJoin(users, eq(clientContacts.userId, users.id))
    .where(eq(clientContacts.id, contactId))
    .limit(1);

  if (!row) return null;
  return {
    contact: row.contact,
    user: { id: row.userId, email: row.userEmail, name: row.userName },
  };
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
  input: AddContactInput,
): Promise<ClientContact> {
  const [row] = await db
    .insert(clientContacts)
    .values({
      clientId: input.clientId,
      name: input.name,
      email: input.email,
      userId: input.userId ?? null,
      isPrimary: input.isPrimary ?? false,
      role: input.role,
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

export async function getClientsForUser(userId: string): Promise<Client[]> {
  const rows = await db
    .select()
    .from(clientContacts)
    .innerJoin(clients, eq(clientContacts.clientId, clients.id))
    .where(and(eq(clientContacts.userId, userId), isNull(clients.archivedAt)))
    .orderBy(asc(clients.name));

  return rows.map((row) => row.clients);
}

export async function getPrimaryClientForUser(userId: string): Promise<Client | null> {
  const rows = await db
    .select()
    .from(clientContacts)
    .innerJoin(clients, eq(clientContacts.clientId, clients.id))
    .where(and(eq(clientContacts.userId, userId), isNull(clients.archivedAt)))
    .orderBy(desc(clientContacts.isPrimary), asc(clients.name))
    .limit(1);

  if (rows.length === 0) return null;
  return rows[0].clients;
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
