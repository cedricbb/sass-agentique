/**
 * Seed script — données de développement
 * Usage : pnpm --filter @saas/db seed
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { env } from "@saas/config";

const BCRYPT_ROUNDS = 12;

async function main() {
  const client = postgres(env.DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log("🌱 Démarrage du seed…");

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminEmail = "admin@saas.dev";
  const adminPassword = await bcrypt.hash("admin1234", BCRYPT_ROUNDS);

  await db
    .insert(schema.users)
    .values({
      email: adminEmail,
      hashedPassword: adminPassword,
      name: "Super Admin",
      role: "admin",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { role: "admin", name: "Super Admin" },
    })
    .returning();

  console.log(`✅ Admin créé : ${adminEmail} / admin1234`);

  // ── Users de démo ───────────────────────────────────────────────────────────
  const demoPassword = await bcrypt.hash("demo1234", BCRYPT_ROUNDS);
  const demoUsersData = [
    { email: "alice@acme.dev", name: "Alice Martin", role: "client" as const },
    { email: "bob@globex.dev", name: "Bob Smith", role: "client" as const },
    { email: "carol@initech.dev", name: "Carol White", role: "client" as const },
    { email: "dave@umbrella.dev", name: "Dave Black", role: "client" as const },
    { email: "eve@banned.dev", name: "Eve Banned", role: "client" as const },
  ];

  const insertedUsers = await Promise.all(
    demoUsersData.map((u) =>
      db
        .insert(schema.users)
        .values({
          ...u,
          hashedPassword: demoPassword,
          emailVerified: true,
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { name: u.name },
        })
        .returning(),
    ),
  );

  // Bannir le dernier user
  const bannedUser = insertedUsers[insertedUsers.length - 1]?.[0];
  if (bannedUser) {
    const { eq } = await import("drizzle-orm");
    await db
      .update(schema.users)
      .set({ bannedAt: new Date() })
      .where(eq(schema.users.id, bannedUser.id));
  }

  console.log(`✅ ${insertedUsers.length} utilisateurs de démo créés (mot de passe: demo1234)`);

  // ── Agent Tasks de démo ─────────────────────────────────────────────────────
  const agentTasksData = [
    {
      agentType: "calendar",
      status: "completed",
      payload: { action: "findFreeSlot", date: "2026-03-04" },
      result: { slot: "14:00-15:00" },
    },
    {
      agentType: "mail",
      status: "running",
      payload: { action: "checkInbox", mailbox: "alice@acme.dev" },
      result: null,
    },
    {
      agentType: "calendar",
      status: "pending",
      payload: { action: "createEvent", title: "Réunion équipe" },
      result: null,
    },
    {
      agentType: "mail",
      status: "failed",
      payload: { action: "draftReply", threadId: "abc123" },
      result: { error: "SMTP_ERROR" },
    },
  ];

  const insertedTasks = await db
    .insert(schema.agentTasks)
    .values(agentTasksData)
    .returning();

  await db.insert(schema.agentLogs).values([
    {
      taskId: insertedTasks[0].id,
      level: "info",
      message: "Démarrage de la recherche de créneau",
    },
    {
      taskId: insertedTasks[0].id,
      level: "info",
      message: "Calendrier chargé — 3 événements existants",
    },
    {
      taskId: insertedTasks[0].id,
      level: "info",
      message: "Créneau trouvé : 14:00-15:00",
    },
    {
      taskId: insertedTasks[1].id,
      level: "info",
      message: "Connexion IMAP en cours…",
    },
    {
      taskId: insertedTasks[3].id,
      level: "error",
      message: "Échec connexion SMTP : timeout",
    },
  ]);

  console.log(`✅ ${insertedTasks.length} agent tasks + logs créés`);

  console.log("\n🎉 Seed terminé !\n");
  console.log("  Admin : admin@saas.dev / admin1234");
  console.log("  Users : alice@acme.dev … / demo1234");

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
