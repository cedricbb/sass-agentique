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

  const [admin] = await db
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

  // ── Tenants de démo ─────────────────────────────────────────────────────────
  const tenantsData = [
    { slug: "acme-corp", name: "Acme Corp", plan: "pro" },
    { slug: "globex", name: "Globex Industries", plan: "business" },
    { slug: "initech", name: "Initech", plan: "free" },
    { slug: "umbrella", name: "Umbrella Co", plan: "pro" },
  ];

  const insertedTenants = await Promise.all(
    tenantsData.map((t) =>
      db
        .insert(schema.tenants)
        .values(t)
        .onConflictDoUpdate({
          target: schema.tenants.slug,
          set: { name: t.name, plan: t.plan },
        })
        .returning(),
    ),
  );

  console.log(`✅ ${insertedTenants.length} tenants créés`);

  // ── Users de démo ───────────────────────────────────────────────────────────
  const demoPassword = await bcrypt.hash("demo1234", BCRYPT_ROUNDS);
  const demoUsersData = [
    { email: "alice@acme.dev", name: "Alice Martin", role: "user" },
    { email: "bob@globex.dev", name: "Bob Smith", role: "user" },
    { email: "carol@initech.dev", name: "Carol White", role: "user" },
    { email: "dave@umbrella.dev", name: "Dave Black", role: "user" },
    { email: "eve@banned.dev", name: "Eve Banned", role: "user" },
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

  // ── Memberships ─────────────────────────────────────────────────────────────
  const flatTenants = insertedTenants.map((t) => t[0]).filter(Boolean);
  const flatUsers = insertedUsers.map((u) => u[0]).filter(Boolean);

  await Promise.all(
    flatTenants.map((tenant, i) => {
      const user = flatUsers[i];
      if (!tenant || !user) return;
      return db
        .insert(schema.memberships)
        .values({
          userId: user.id,
          tenantId: tenant.id,
          role: "OWNER",
        })
        .onConflictDoNothing();
    }),
  );

  // Admin dans le premier tenant
  const firstTenant = flatTenants[0];
  if (firstTenant && admin) {
    await db
      .insert(schema.memberships)
      .values({
        userId: admin.id,
        tenantId: firstTenant.id,
        role: "ADMIN",
      })
      .onConflictDoNothing();
  }

  console.log("✅ Memberships créés");

  // ── Agent Tasks de démo ─────────────────────────────────────────────────────
  if (firstTenant) {
    const agentTasksData = [
      {
        tenantId: firstTenant.id,
        agentType: "calendar",
        status: "completed",
        payload: { action: "findFreeSlot", date: "2026-03-04" },
        result: { slot: "14:00-15:00" },
      },
      {
        tenantId: firstTenant.id,
        agentType: "mail",
        status: "running",
        payload: { action: "checkInbox", mailbox: "alice@acme.dev" },
        result: null,
      },
      {
        tenantId: firstTenant.id,
        agentType: "calendar",
        status: "pending",
        payload: { action: "createEvent", title: "Réunion équipe" },
        result: null,
      },
      {
        tenantId: firstTenant.id,
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

    // Ajouter des logs sur les tasks
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
  }

  console.log("\n🎉 Seed terminé !\n");
  console.log("  Admin : admin@saas.dev / admin1234");
  console.log("  Users : alice@acme.dev … / demo1234");

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
