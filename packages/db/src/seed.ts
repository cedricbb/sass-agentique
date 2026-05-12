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

  // ── Clients ─────────────────────────────────────────────────────────────────
  const [acme] = await db
    .insert(schema.clients)
    .values({
      name: "Acme Studio",
      slug: "acme-studio",
      type: "company",
    })
    .onConflictDoUpdate({
      target: schema.clients.slug,
      set: { name: "Acme Studio" },
    })
    .returning();

  const [bob] = await db
    .insert(schema.clients)
    .values({
      name: "Bob Indep",
      slug: "bob-indep",
      type: "individual",
    })
    .onConflictDoUpdate({
      target: schema.clients.slug,
      set: { name: "Bob Indep" },
    })
    .returning();

  const [globex] = await db
    .insert(schema.clients)
    .values({
      name: "Globex",
      slug: "globex",
      type: "company",
    })
    .onConflictDoUpdate({
      target: schema.clients.slug,
      set: { name: "Globex" },
    })
    .returning();

  console.log(`✅ 3 clients créés : ${acme.slug}, ${bob.slug}, ${globex.slug}`);

  // ── Prestations ─────────────────────────────────────────────────────────────
  const [siteVitrine] = await db
    .insert(schema.prestations)
    .values({
      slug: "site-vitrine-5p",
      name: "Site vitrine 5 pages",
      kind: "one_shot",
      basePriceEurCents: 250000,
      sortOrder: 1,
    })
    .onConflictDoUpdate({
      target: schema.prestations.slug,
      set: { name: "Site vitrine 5 pages" },
    })
    .returning();

  const [maintenanceMensuelle] = await db
    .insert(schema.prestations)
    .values({
      slug: "maintenance-mensuelle",
      name: "Maintenance mensuelle",
      kind: "recurring",
      basePriceEurCents: 5000,
      sortOrder: 2,
    })
    .onConflictDoUpdate({
      target: schema.prestations.slug,
      set: { name: "Maintenance mensuelle" },
    })
    .returning();

  console.log(`✅ 2 prestations créées : ${siteVitrine.slug}, ${maintenanceMensuelle.slug}`);

  // ── Project ─────────────────────────────────────────────────────────────────
  const [project] = await db
    .insert(schema.projects)
    .values({
      clientId: acme.id,
      name: "Site Acme",
      slug: "site-acme",
      status: "active",
    })
    .onConflictDoUpdate({
      target: schema.projects.slug,
      set: { name: "Site Acme" },
    })
    .returning();

  console.log(`✅ 1 projet créé : ${project.slug}`);

  // ── Quote ───────────────────────────────────────────────────────────────────
  const [quote] = await db
    .insert(schema.quotes)
    .values({
      clientId: acme.id,
      number: "Q-2026-001",
      status: "draft",
      totalEurCents: 255000,
    })
    .onConflictDoUpdate({
      target: schema.quotes.number,
      set: { totalEurCents: 255000 },
    })
    .returning();

  console.log(`✅ 1 devis créé : ${quote.number}`);

  // ── Quote Items ─────────────────────────────────────────────────────────────
  await db
    .insert(schema.quoteItems)
    .values([
      {
        quoteId: quote.id,
        prestationId: siteVitrine.id,
        description: "Site vitrine 5 pages",
        quantity: 1,
        unitPriceEurCents: 250000,
        sortOrder: 1,
      },
      {
        quoteId: quote.id,
        prestationId: maintenanceMensuelle.id,
        description: "Maintenance mensuelle",
        quantity: 1,
        unitPriceEurCents: 5000,
        sortOrder: 2,
      },
    ]);

  console.log("✅ 2 quote items créés");

  console.log("\n🎉 Seed terminé !\n");
  console.log("  Admin : admin@saas.dev / admin1234");

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
