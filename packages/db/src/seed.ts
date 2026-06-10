/**
 * Seed script — données de développement
 * Usage : pnpm --filter @saas/db seed
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

export const SEED_PAYMENT_REFS = ["pi_seed_002", "vir_seed_003", "chk_seed_004"];
export const SEED_CONTRACT_COUNT = 3;
export const SEED_CONTRACT_ACTIVE_COUNT = 2;
export const SEED_CONTRACT_CANCELED_COUNT = 1;
import { env } from "@saas/config";

const BCRYPT_ROUNDS = 12;

async function main() {
  const client = postgres(env.DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log("🌱 Démarrage du seed…");

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminEmail = "admin@saas.dev";
  const adminPassword = await bcrypt.hash("admin1234", BCRYPT_ROUNDS);

  const [adminUser] = await db
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
  const seedAdminId = adminUser.id;

  console.log(`✅ Admin créé : ${adminEmail} / admin1234`);

  // ── Clients ─────────────────────────────────────────────────────────────────
  const [acme] = await db
    .insert(schema.clients)
    .values({
      ownerId: seedAdminId,
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
      ownerId: seedAdminId,
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
      ownerId: seedAdminId,
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
      ownerId: seedAdminId,
      slug: "site-vitrine-5p",
      name: "Site vitrine 5 pages",
      kind: "one_shot",
      basePriceEurCents: 250000,
      sortOrder: 1,
    })
    .onConflictDoUpdate({
      target: [schema.prestations.ownerId, schema.prestations.slug],
      set: { name: "Site vitrine 5 pages" },
    })
    .returning();

  const [maintenanceMensuelle] = await db
    .insert(schema.prestations)
    .values({
      ownerId: seedAdminId,
      slug: "maintenance-mensuelle",
      name: "Maintenance mensuelle",
      kind: "recurring",
      basePriceEurCents: 5000,
      sortOrder: 2,
    })
    .onConflictDoUpdate({
      target: [schema.prestations.ownerId, schema.prestations.slug],
      set: { name: "Maintenance mensuelle" },
    })
    .returning();

  console.log(`✅ 2 prestations créées : ${siteVitrine.slug}, ${maintenanceMensuelle.slug}`);

  // ── Project ─────────────────────────────────────────────────────────────────
  const [project] = await db
    .insert(schema.projects)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      name: "Site Acme",
      slug: "site-acme",
      status: "active",
    })
    .onConflictDoUpdate({
        target: [schema.projects.clientId, schema.projects.slug],
        set: { name: "Site Acme" },
    })
    .returning();

  const [brouillonDemo] = await db
    .insert(schema.projects)
    .values({
      ownerId: seedAdminId,
      clientId: bob.id,
      name: "Brouillon démo",
      slug: "brouillon-demo",
      status: "draft",
    })
    .onConflictDoUpdate({
      target: [schema.projects.clientId, schema.projects.slug],
      set: { name: "Brouillon démo" },
    })
    .returning();

  const [refonteEcommerce] = await db
    .insert(schema.projects)
    .values({
      ownerId: seedAdminId,
      clientId: globex.id,
      name: "Refonte e-commerce",
      slug: "refonte-ecommerce",
      status: "on_hold",
    })
    .onConflictDoUpdate({
      target: [schema.projects.clientId, schema.projects.slug],
      set: { name: "Refonte e-commerce" },
    })
    .returning();

  const [auditSeoAcme] = await db
    .insert(schema.projects)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      name: "Audit SEO Acme",
      slug: "audit-seo-acme",
      status: "delivered",
    })
    .onConflictDoUpdate({
      target: [schema.projects.clientId, schema.projects.slug],
      set: { name: "Audit SEO Acme" },
    })
    .returning();

  const [pocAbandonne] = await db
    .insert(schema.projects)
    .values({
      ownerId: seedAdminId,
      clientId: bob.id,
      name: "POC abandonné",
      slug: "poc-abandonne",
      status: "cancelled",
    })
    .onConflictDoUpdate({
      target: [schema.projects.clientId, schema.projects.slug],
      set: { name: "POC abandonné" },
    })
    .returning();

  console.log("✅ 5 projets créés (1 par statut : active, draft, on_hold, delivered, cancelled)");

  // ── Quote ───────────────────────────────────────────────────────────────────
  const [quote] = await db
    .insert(schema.quotes)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      number: "Q-2026-001",
      status: "draft",
      totalEurCents: 255000,
    })
    .onConflictDoUpdate({
      target: [schema.quotes.ownerId, schema.quotes.number],
      set: { totalEurCents: 255000 },
    })
    .returning();

  const [quote2] = await db
    .insert(schema.quotes)
    .values({
      ownerId: seedAdminId,
      clientId: bob.id,
      number: "Q-2026-002",
      status: "sent",
      totalEurCents: 250000,
    })
    .onConflictDoUpdate({
      target: [schema.quotes.ownerId, schema.quotes.number],
      set: { totalEurCents: 250000, status: "sent" },
    })
    .returning();

  const [quote3] = await db
    .insert(schema.quotes)
    .values({
      ownerId: seedAdminId,
      clientId: globex.id,
      number: "Q-2026-003",
      status: "accepted",
      totalEurCents: 5000,
    })
    .onConflictDoUpdate({
      target: [schema.quotes.ownerId, schema.quotes.number],
      set: { totalEurCents: 5000, status: "accepted" },
    })
    .returning();

  const [quote4] = await db
    .insert(schema.quotes)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      number: "Q-2026-004",
      status: "declined",
      totalEurCents: 250000,
    })
    .onConflictDoUpdate({
      target: [schema.quotes.ownerId, schema.quotes.number],
      set: { totalEurCents: 250000, status: "declined" },
    })
    .returning();

  const [quote5] = await db
    .insert(schema.quotes)
    .values({
      ownerId: seedAdminId,
      clientId: bob.id,
      number: "Q-2026-005",
      status: "expired",
      totalEurCents: 5000,
    })
    .onConflictDoUpdate({
      target: [schema.quotes.ownerId, schema.quotes.number],
      set: { totalEurCents: 5000, status: "expired" },
    })
    .returning();

  console.log("✅ 5 devis créés (1 par statut : draft, sent, accepted, declined, expired)");

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

  await db.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quote2.id));
  await db.insert(schema.quoteItems).values({
    quoteId: quote2.id,
    prestationId: siteVitrine.id,
    description: "Site vitrine 5 pages",
    quantity: 1,
    unitPriceEurCents: 250000,
    sortOrder: 1,
  });

  await db.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quote3.id));
  await db.insert(schema.quoteItems).values({
    quoteId: quote3.id,
    prestationId: maintenanceMensuelle.id,
    description: "Maintenance mensuelle",
    quantity: 1,
    unitPriceEurCents: 5000,
    sortOrder: 1,
  });

  await db.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quote4.id));
  await db.insert(schema.quoteItems).values({
    quoteId: quote4.id,
    prestationId: siteVitrine.id,
    description: "Site vitrine 5 pages",
    quantity: 1,
    unitPriceEurCents: 250000,
    sortOrder: 1,
  });

  await db.delete(schema.quoteItems).where(eq(schema.quoteItems.quoteId, quote5.id));
  await db.insert(schema.quoteItems).values({
    quoteId: quote5.id,
    prestationId: maintenanceMensuelle.id,
    description: "Maintenance mensuelle",
    quantity: 1,
    unitPriceEurCents: 5000,
    sortOrder: 1,
  });

  console.log("✅ Quote items créés pour les 5 devis");

  // ── Invoices ────────────────────────────────────────────────────────────────
  const [inv1] = await db
    .insert(schema.invoices)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      number: "INV-2026-001",
      status: "draft",
      totalEurCents: 25000,
      vatRateBps: 2000,
    })
    .onConflictDoUpdate({
      target: [schema.invoices.ownerId, schema.invoices.number],
      set: { totalEurCents: 25000, status: "draft" },
    })
    .returning();

  const [inv2] = await db
    .insert(schema.invoices)
    .values({
      ownerId: seedAdminId,
      clientId: bob.id,
      number: "INV-2026-002",
      status: "sent",
      totalEurCents: 25000,
      vatRateBps: 2000,
      issuedAt: new Date("2026-03-15T00:00:00Z"),
      dueAt: new Date("2026-04-15T00:00:00Z"),
    })
    .onConflictDoUpdate({
      target: [schema.invoices.ownerId, schema.invoices.number],
      set: { totalEurCents: 25000, status: "sent" },
    })
    .returning();

  const [inv3] = await db
    .insert(schema.invoices)
    .values({
      ownerId: seedAdminId,
      clientId: globex.id,
      quoteId: quote3.id,
      number: "INV-2026-003",
      status: "paid",
      totalEurCents: 5000,
      vatRateBps: 2000,
      issuedAt: new Date("2026-02-01T00:00:00Z"),
      dueAt: new Date("2026-03-01T00:00:00Z"),
      paidAt: new Date("2026-02-20T00:00:00Z"),
    })
    .onConflictDoUpdate({
      target: [schema.invoices.ownerId, schema.invoices.number],
      set: { totalEurCents: 5000, status: "paid" },
    })
    .returning();

  const [inv4] = await db
    .insert(schema.invoices)
    .values({
      ownerId: seedAdminId,
      clientId: acme.id,
      number: "INV-2026-004",
      status: "sent",
      totalEurCents: 40000,
      vatRateBps: 2000,
      issuedAt: new Date("2026-04-01T00:00:00Z"),
      dueAt: new Date("2026-05-01T00:00:00Z"),
    })
    .onConflictDoUpdate({
      target: [schema.invoices.ownerId, schema.invoices.number],
      set: { totalEurCents: 40000, status: "sent" },
    })
    .returning();

  console.log("✅ 4 factures créées");

  // ── Invoice Items ──────────────────────────────────────────────────────────
  await db.delete(schema.invoiceItems).where(inArray(schema.invoiceItems.invoiceId, [inv2.id, inv3.id, inv4.id]));
  await db.insert(schema.invoiceItems).values([
    { invoiceId: inv2.id, description: "Développement API", quantity: 2, unitPriceEurCents: 10000, sortOrder: 0 },
    { invoiceId: inv2.id, description: "Intégration frontend", quantity: 1, unitPriceEurCents: 5000, sortOrder: 1 },
    { invoiceId: inv3.id, description: "Audit sécurité", quantity: 1, unitPriceEurCents: 5000, sortOrder: 0 },
    { invoiceId: inv4.id, description: "Développement module client", quantity: 3, unitPriceEurCents: 10000, sortOrder: 0 },
    { invoiceId: inv4.id, description: "Design UX", quantity: 1, unitPriceEurCents: 10000, sortOrder: 1 },
  ]);
  console.log("✅ Invoice items créés : 2 sur INV-2026-002, 1 sur INV-2026-003, 2 sur INV-2026-004 (INV-2026-001 reste vide)");

  // ── Payments ────────────────────────────────────────────────────────────────
  await db.delete(schema.payments).where(eq(schema.payments.invoiceId, inv2.id));
  await db.delete(schema.payments).where(eq(schema.payments.invoiceId, inv1.id));
  await db.delete(schema.payments).where(eq(schema.payments.invoiceId, inv3.id));
  await db.delete(schema.payments).where(eq(schema.payments.invoiceId, inv4.id));

  await db.insert(schema.payments).values([
    {
      ownerId: seedAdminId,
      invoiceId: inv2.id,
      amountCents: 5000,
      method: "bank_transfer",
      paidAt: new Date("2026-03-20T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      invoiceId: inv2.id,
      amountCents: 10000,
      method: "stripe_card",
      externalRef: "pi_seed_002",
      paidAt: new Date("2026-04-15T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      invoiceId: inv1.id,
      amountCents: 8000,
      method: "other",
      externalRef: "chk_seed_004",
      paidAt: new Date("2026-05-01T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      invoiceId: inv4.id,
      amountCents: 20000,
      method: "bank_transfer",
      paidAt: new Date("2026-04-20T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      invoiceId: inv3.id,
      amountCents: 15000,
      method: "bank_transfer",
      externalRef: "vir_seed_003",
      paidAt: new Date("2026-05-10T00:00:00Z"),
    },
  ]);

  console.log("✅ 5 paiements créés (3 méthodes, multi-invoices)");

  // ── Reports ─────────────────────────────────────────────────────────────────
  await db.delete(schema.reports).where(
    inArray(schema.reports.clientId, [acme.id, bob.id, globex.id]),
  );
  await db.insert(schema.reports).values([
    {
      ownerId: seedAdminId,
      clientId: acme.id,
      title: "Livrable v1 site vitrine",
      kind: "delivery",
      issuedAt: null,
      filePath: "reports/2026/01/seed-acme-delivery-draft.pdf",
    },
    {
      ownerId: seedAdminId,
      clientId: bob.id,
      title: "Rapport mensuel maintenance — Janvier 2026",
      kind: "monthly",
      issuedAt: new Date("2026-02-05T10:00:00Z"),
      filePath: "reports/2026/02/seed-bob-monthly.pdf",
    },
    {
      ownerId: seedAdminId,
      clientId: globex.id,
      title: "Audit sécurité Q1 2026",
      kind: "audit",
      issuedAt: new Date("2026-03-30T16:00:00Z"),
      filePath: "reports/2026/03/seed-globex-audit.pdf",
    },
    {
      ownerId: seedAdminId,
      clientId: acme.id,
      title: "Rapport mensuel Acme — Avril 2026",
      kind: "monthly",
      issuedAt: new Date("2026-04-15T10:00:00Z"),
      filePath: "reports/2026/04/seed-acme-monthly.pdf",
    },
  ]);
  console.log("✅ 4 reports créés : 1 delivery Brouillon (Acme), 1 monthly Émis (Bob), 1 audit Émis (Globex), 1 monthly Émis (Acme)");

  // ── Maintenance Contracts ──────────────────────────────────────────────────
  await db.delete(schema.maintenanceContracts).where(
    inArray(schema.maintenanceContracts.clientId, [acme.id, bob.id, globex.id]),
  );
  await db.insert(schema.maintenanceContracts).values([
    {
      ownerId: seedAdminId,
      clientId: acme.id,
      prestationId: maintenanceMensuelle.id,
      billingMode: "manual_invoice",
      status: "active",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-01-15T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      clientId: bob.id,
      prestationId: maintenanceMensuelle.id,
      billingMode: "stripe_auto",
      status: "active",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-02-01T00:00:00Z"),
    },
    {
      ownerId: seedAdminId,
      clientId: globex.id,
      prestationId: maintenanceMensuelle.id,
      billingMode: "manual_invoice",
      status: "canceled",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-01-10T00:00:00Z"),
      canceledAt: new Date("2026-03-01T00:00:00Z"),
    },
  ]);
  console.log("✅ 3 contrats de maintenance créés (2 active, 1 canceled)");

  // ── Client users ────────────────────────────────────────────────────────────
  const clientPassword = await bcrypt.hash("client1234", BCRYPT_ROUNDS);

  const [clientAcmeUser] = await db
    .insert(schema.users)
    .values({
      email: "client-acme@saas.dev",
      hashedPassword: clientPassword,
      name: "Client Acme",
      role: "client",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { role: "client", name: "Client Acme" },
    })
    .returning({ id: schema.users.id });

  const [clientBobUser] = await db
    .insert(schema.users)
    .values({
      email: "client-bob@saas.dev",
      hashedPassword: clientPassword,
      name: "Client Bob",
      role: "client",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { role: "client", name: "Client Bob" },
    })
    .returning({ id: schema.users.id });

  const [clientGlobexUser] = await db
    .insert(schema.users)
    .values({
      email: "client-globex@saas.dev",
      hashedPassword: clientPassword,
      name: "Client Globex",
      role: "client",
      emailVerified: true,
    })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { role: "client", name: "Client Globex" },
    })
    .returning({ id: schema.users.id });

  await db
    .delete(schema.clientContacts)
    .where(inArray(schema.clientContacts.clientId, [acme.id, bob.id, globex.id]));

  await db.insert(schema.clientContacts).values({
    clientId: acme.id,
    name: "Client Acme",
    email: "client-acme@saas.dev",
    userId: clientAcmeUser.id,
    isPrimary: true,
  });

  await db.insert(schema.clientContacts).values({
    clientId: bob.id,
    name: "Client Bob",
    email: "client-bob@saas.dev",
    userId: clientBobUser.id,
    isPrimary: true,
  });

  await db.insert(schema.clientContacts).values({
    clientId: globex.id,
    name: "Client Globex",
    email: "client-globex@saas.dev",
    userId: clientGlobexUser.id,
    isPrimary: true,
  });

  console.log("✅ 3 client users créés + contacts liés");

  console.log("\n🎉 Seed terminé !\n");
  console.log("  Admin   : admin@saas.dev / admin1234");
  console.log("  Client  : client-acme@saas.dev / client1234");
  console.log("  Client  : client-bob@saas.dev / client1234");
  console.log("  Client  : client-globex@saas.dev / client1234");

  await client.end();
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
