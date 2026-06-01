# SaaS Agentique

Boilerplate SaaS avec stack agentique IA. Architecture monorepo Turborepo, authentification complète maison (email + sessions + 2FA/OTP), RBAC CASL, billing Stripe, workflows Inngest et agents IA via Vercel AI SDK + Claude.

> **Pivot avancé (mai 2026)** — Le projet pivote d'un modèle SaaS multi-tenant B2B vers un modèle freelance solo-admin. R1 (suppression multi-tenant) et R2 (schéma + services domaine) sont complétés. R3 (Stripe Billing solo) est en cours. R4 (modules admin frontend) est largement avancé — onze modules livrés : clients, prestations, projets, devis, factures, paiements, contrats de maintenance, rapports, tâches agents IA, utilisateurs et profil admin. Dashboard avec graphiques analytiques (revenus mensuels, ventilation statuts factures). R5 (Portail client) a démarré — pages compte, devis, factures et rapports en cours de construction. Tag de rollback : `pre-pivot-v1`. Voir `docs/PIVOT.md` pour le contexte complet.

<!-- SECTION:overview -->
## Vue d'ensemble

**sass-agentique** est un point de départ production-ready pour construire un SaaS avec capacités agentiques. Il combine une architecture monorepo strictement en couches avec une stack moderne TypeScript.

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 15 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS v4 + Radix |
| Auth | Sessions custom (bcryptjs) + 2FA TOTP (otplib) |
| RBAC | CASL v6 |
| ORM | Drizzle ORM v0.38 |
| Base de données | PostgreSQL 15 |
| Stockage fichiers | Cloudflare R2 (S3-compatible) via AWS SDK v3 |
| Paiements | Stripe (abonnements + webhooks + portail client) |
| Workflows | Inngest v3 |
| Agents IA | Vercel AI SDK v4 + Anthropic Claude API |
| Emails | Resend + React Email (prod) · Nodemailer/MailHog (dev) |
| Monorepo | Turborepo v2.4 + pnpm v9.1.1 workspaces |
| Tests | Vitest v3 (unit/intégr.) + Playwright v1.50 (e2e) |
| CI/CD | GitHub Actions (3 jobs parallèles) |

### Packages du monorepo

| Package | Rôle |
|---------|------|
| `@saas/config` | Validation variables d'environnement (Zod) + plans de facturation |
| `@saas/db` | Drizzle ORM + schéma PostgreSQL + migrations |
| `@saas/services` | Business logic (auth, admin, stripe, TOTP, email, profil, client, prestation, projet, devis, facture, paiement, rapport, contrats de maintenance) |
| `@saas/permissions` | CASL RBAC — rôles × actions × ressources |
| `@saas/workflows` | Inngest jobs et CRONs (placeholder) |
| `@saas/agents` | Stack agentique BaseAgent + tools (placeholder) |
| `@saas/ui` | Design system partagé (shadcn/ui) |
<!-- END:overview -->

<!-- SECTION:getting-started -->
## Démarrage rapide

### Prérequis

- Node.js v20+
- pnpm v9.1.1+
- Docker (pour PostgreSQL local)

### Installation

```bash
# 1. Cloner et installer les dépendances
git clone https://github.com/cedricbb/sass-agentique.git
cd sass-agentique
pnpm install

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec les valeurs appropriées

# 3. Démarrer la base de données
docker compose -f infra/docker-compose.yml up -d

# 4. Appliquer les migrations
pnpm --filter @saas/db push

# 5. Peupler la base (optionnel)
pnpm --filter @saas/db seed

# 6. Lancer le serveur de développement
pnpm dev
```

L'application est disponible sur [http://localhost:3001](http://localhost:3001).

### Seed — données de démonstration

```
admin@saas.dev / admin1234   → rôle admin (seul utilisateur créé)
```

Le script seed peuple également :

| Entité | Données |
|--------|---------|
| Clients | Acme Studio (company), Bob Indep (individual), Globex (company) |
| Prestations | Site vitrine 5 pages (€2 500, one-shot), Maintenance mensuelle (€50, recurring) |
| Projet | Site Acme (client : Acme Studio, statut : active) |
| Devis | Q-2026-001 — €2 550 TTC, 2 lignes (site vitrine + maintenance) |

### Commandes utiles

```bash
# Développement
pnpm dev                          # Démarre toutes les apps en parallèle
pnpm build                        # Build de production

# Qualité
pnpm lint                         # ESLint sur tous les packages
pnpm check-types                  # TypeScript sur tous les packages
pnpm format                       # Prettier

# Tests
pnpm test                         # Vitest (unit + intégration)
pnpm test:e2e                     # Playwright (e2e)

# Base de données
pnpm --filter @saas/db generate   # Générer une migration
pnpm --filter @saas/db push       # Appliquer les migrations
pnpm --filter @saas/db studio     # Drizzle Studio (UI DB)
pnpm --filter @saas/db seed       # Peupler avec données de démonstration

# Scripts Stripe
pnpm --filter scripts stripe-sync # Synchroniser les plans vers Stripe
```
<!-- END:getting-started -->

<!-- SECTION:architecture -->
## Architecture

### Couches strictes (UI → Service → Persistence)

```
UI (Next.js 15 App Router)
    ↓  Server Actions / API Routes
Services (@saas/services)
    ↓  Drizzle queries
DB (@saas/db) — PostgreSQL 15

Stockage fichiers : R2 (Cloudflare) via lib/storage/r2.ts
```

### Structure du monorepo

```
sass-agentique/
├── apps/
│   └── web/                      # Application Next.js 15 (port 3001)
│       ├── app/
│       │   ├── (marketing)/      # Landing page publique
│       │   ├── (auth)/           # Login, register, 2FA, reset password
│       │   ├── (app)/            # Application authentifiée (paramètres)
│       │   ├── (admin)/          # Backoffice admin
│       │   │   └── admin/
│       │   │       ├── clients/        # Module clients (liste, [id], new)
│       │   │       ├── prestations/    # Module prestations (liste, [id], new)
│       │   │       ├── projects/       # Module projets (liste, [id], new)
│       │   │       ├── quotes/         # Module devis (liste, [id], new)
│       │   │       ├── invoices/       # Module factures (liste, [id])
│       │   │       ├── payments/       # Module paiements (liste globale, lecture seule)
│       │   │       ├── contracts/      # Module contrats de maintenance
│       │   │       ├── reports/        # Module rapports (génération, stockage R2)
│       │   │       ├── agent-tasks/    # Monitoring tâches IA
│       │   │       ├── users/          # Gestion utilisateurs (ban/unban)
│       │   │       ├── profile/        # Profil admin
│       │   │       └── spike-upload/   # Spike R2 — upload/lecture PDF (expérimental)
│       │   ├── (customer)/       # Portail client (R5 — en cours)
│       │   │   └── account/
│       │   │       ├── page.tsx        # Tableau de bord compte client
│       │   │       ├── quotes/         # Devis (lecture client)
│       │   │       ├── invoices/       # Factures (lecture client)
│       │   │       ├── reports/        # Rapports (lecture client)
│       │   │       ├── profile/        # Profil client
│       │   │       └── security/       # Paramètres de sécurité
│       │   ├── actions/          # Server Actions
│       │   │   └── __tests__/    # Tests des Server Actions
│       │   └── api/
│       │       └── admin/
│       │           └── agent-tasks/  # API tâches agents IA
│       ├── components/
│       │   ├── admin/            # Composants admin spécifiques
│       │   ├── billing/          # Composants billing (+ tests)
│       │   ├── dashboard/        # Graphiques analytiques (MonthlyRevenueChart, InvoiceStatusBreakdownChart)
│       │   ├── layout/           # Composants de layout (CustomerShell, CustomerSidebar, + tests)
│       │   └── ui/               # Composants UI partagés (badge, data-table, + tests)
│       ├── lib/
│       │   ├── auth.ts           # Helpers auth (session, guards)
│       │   ├── dashboard/        # Données et utilitaires du tableau de bord
│       │   ├── hooks/            # Hooks custom (use-data-table-state…)
│       │   ├── schemas/          # Validation Zod (client, prestation, project)
│       │   ├── storage/          # Client R2/Cloudflare (upload, delete, stream PDF)
│       │   └── __tests__/        # Tests utilitaires
│       └── middleware.ts         # Auth guard
├── packages/
│   ├── config/                   # Zod env + plans (Free/Pro/Business)
│   ├── db/                       # Drizzle ORM + schéma
│   ├── services/                 # Business logic par domaine
│   ├── permissions/              # CASL (actions : read/invite/remove/update/cancel/manage)
│   ├── workflows/                # Inngest (placeholder)
│   ├── agents/                   # AI agents (placeholder)
│   └── ui/                       # Design system
├── docs/
│   ├── PIVOT.md                  # Résumé du pivot (TL;DR)
│   ├── pivot-document.md         # Analyse complète + roadmap R1–R7
│   └── pivot-r3-architecture.md  # Architecture Stripe Billing solo (R3)
├── scripts/                      # stripe-sync et utilitaires
├── tests/
│   └── e2e/                      # Specs Playwright
│       └── helpers/              # Utilitaires E2E (auth, data)
├── infra/
│   └── docker-compose.yml        # PostgreSQL 15 (port 5466)
└── .github/
    └── workflows/ci.yml          # 3 jobs : lint · unit · e2e
```

### Schéma de base de données (état post-R2)

#### Authentification & agents

```
users              — id, email, hashed_password, role (admin|client),
                     totp_secret, totp_enabled, backup_codes,
                     name, bio, location, website, social_links,
                     banned_at, created_at, updated_at
sessions           — id, user_id (FK), session_token, expires
email_verifications— id, user_id (FK), token, expires_at
password_resets    — id, user_id (FK), token, expires_at
totp_challenges    — id, user_id (FK), token, expires_at
agent_tasks        — id, agent_type, status, payload (JSON), result (JSON)
agent_logs         — id, task_id (FK), level, message
```

#### Domaine freelance (R2 — migré)

```
clients            — id, slug, name, type (company|individual),
                     email, phone, billing_address (JSONB), notes,
                     archived_at, created_at, updated_at
client_contacts    — id, client_id (FK), user_id (FK), is_primary, role
projects           — id, client_id (FK), slug, name,
                     status (draft|active|on_hold|delivered|cancelled),
                     started_at, delivered_at, created_at, updated_at
prestations        — id, slug, name, kind (one_shot|recurring),
                     base_price_eur_cents, stripe_product_id, stripe_price_id,
                     is_active, sort_order, created_at, updated_at
quotes             — id, client_id (FK), project_id (FK, opt.), number,
                     status (draft|sent|accepted|declined|expired),
                     issued_at, expires_at, accepted_at, total_eur_cents,
                     vat_rate_bps, notes, created_at, updated_at
quote_items        — id, quote_id (FK), prestation_id (FK, opt.),
                     description, quantity, unit_price_eur_cents, sort_order
invoices           — id, client_id (FK), quote_id (FK, opt.), project_id (FK, opt.),
                     number, status (draft|sent|paid|overdue|cancelled),
                     issued_at, due_at, paid_at, total_eur_cents, vat_rate_bps,
                     stripe_payment_intent_id, stripe_checkout_session_id, notes
invoice_items      — id, invoice_id (FK), description, quantity,
                     unit_price_eur_cents, sort_order
payments           — id, invoice_id (FK), amount_eur_cents,
                     method (stripe_card|bank_transfer|other),
                     external_ref, paid_at, notes, created_at
reports            — id, client_id (FK), project_id (FK, opt.), title,
                     kind (delivery|monthly|audit|other), file_path,
                     summary, issued_at, created_at, updated_at
maintenance_contracts — id, client_id (FK), prestation_id (FK),
                     billing_mode (stripe_auto|manual_invoice),
                     status (active|past_due|canceled),
                     stripe_subscription_id, stripe_customer_id,
                     monthly_price_eur_cents, started_at, canceled_at
```

### Règles d'architecture (voir `CLAUDE.md`)

- Les composants React ne font **jamais** d'appels Drizzle directs
- Les services n'importent **jamais** React
- Les mutations passent par Server Actions ou API Routes dédiées
- Les agents étendent `BaseAgent`, injectent leurs tools et loggent chaque appel
<!-- END:architecture -->

<!-- SECTION:features -->
## Fonctionnalités

### Roadmap initiale (phases 0–11)

| Phase | Feature | Statut |
|-------|---------|--------|
| 0 | Fondations (monorepo, DB, CI, Next.js 15) | ✅ Fait |
| 1 | Auth Core (sessions, emails, reset password) | ✅ Fait |
| 2 | Multi-tenant (workspaces, invitations) | ✅ Fait → supprimé (pivot) |
| 3 | RBAC CASL (rôles, guards serveur + client) | ✅ Fait |
| 4 | 2FA / OTP (TOTP RFC 6238, QR code) | ✅ Fait |
| 5 | Stripe Billing (plans, webhooks, portail client) | 🔄 En cours (R3) |
| 6 | Inngest Workflows (events, CRONs) | — |
| 7 | Admin Backoffice | 🔄 En cours (R4) |
| 8 | Stack Agentique IA (BaseAgent, outils) | — |
| 9 | Tests & Qualité (coverage 80%+) | — |
| 10 | CI/CD & Déploiement (Vercel + Railway) | — |
| 11 | Landing Page & GTM | — |

### Pivot mai 2026 — Roadmap freelance (R1–R7)

Le projet pivote vers un modèle solo-admin sans multi-tenant. Voir `docs/pivot-document.md`.

| Phase | Objectif | Durée estimée | Statut |
|-------|---------|---------------|--------|
| R1 | Suppression multi-tenant (services, schéma, UI) | 1 semaine | ✅ Complété |
| R2 | Nouveau schéma + services : clients, projets, devis, factures, paiements, rapports | 1 semaine | ✅ Complété |
| R3 | Refonte Stripe Billing (solo) | 1 semaine | 🔄 En cours |
| R4 | Modules admin frontend : clients, projets, devis, factures, contrats, rapports, agents, users, profil | 1–2 semaines | 🔄 En cours avancé |
| R5 | Portail client frontend : compte, devis, factures, rapports | 1–2 semaines | 🔄 En cours |
| R6 | Intégration portfolio (pages marketing) | 1 semaine | — |
| R7 | Quick wins productivité : PDF, acceptation en ligne, emails auto | 1 semaine | — |

**R1 — Complété** : services multi-tenant supprimés (tenant, invitation, membership, subscription), schéma DB simplifié, composants UI nettoyés, permission layer et ability hook supprimés.

**R2 — Complété** : schéma du domaine freelance migré (clients, projets, prestations, devis, factures, paiements, rapports, contrats de maintenance). Ensemble des services domaine implémentés et exposés via `@saas/services`.

**R3 — En cours** : suppression des anciennes routes billing multi-tenant (`api/billing/`, `api/webhooks/stripe/`) et des composants layout legacy. Refonte en cours pour un modèle Stripe solo-admin. Architecture documentée dans `docs/pivot-r3-architecture.md`.

**R4 — Complété** : onze modules admin + flow invitation customer —

- **Clients** : Server Actions (`actions/clients.ts`), pages liste (`/admin/clients`), création (`/admin/clients/new`), détail/édition (`/admin/clients/[id]`), composants `ClientForm`, `ClientsTable`, `DeleteClientButton`. Section "Accès portail" sur la fiche client : tableau des contacts avec 3 états ("À inviter" / "Invitation en cours" / "Compte créé"), Server Action `inviteCustomerAction` (anti-IDOR, `requireAdmin`), dialog de confirmation `InviteCustomerDialog`. État "Compte créé" (R4.6e) : Tooltip shadcn au survol (email + nom du user lié), colonne Action affichant la date de liaison effective (`consumedAt`). Flow set-password customer complet (R4.6c) : page `/set-password` (validation token au GET, 2 forms selon état du compte), `setInitialPasswordAction`/`linkExistingAccountAction`, auto-login + redirect `/account/`, migration `clientContacts.userId` (FK SET NULL, index non-unique). Voir `docs/customer-invitations.md`.
- **Prestations** : Server Actions (`actions/prestations.ts`), schémas Zod (`lib/schemas/prestation.schemas.ts`), page liste (`/admin/prestations`), composants `PrestationForm`, `PrestationsTable`, `ArchivePrestationButton`.
- **Projets** : Server Actions (`actions/projects.ts`), schémas Zod (`lib/schemas/project.schemas.ts`), pages liste (`/admin/projects`), création (`/admin/projects/new`), détail/édition (`/admin/projects/[id]`), composants `ProjectsTable`, `ProjectForm`, `ProjectStatusActions`. Error boundary dédié.
- **Devis** : Server Actions (`actions/quotes.ts`, `actions/quote-items.ts`), pages liste et détail, composants `QuotesTable`, `QuoteForm`, `QuoteItemsEditor`, `EditQuoteItemDialog`, `QuoteStatusActions`, `QuoteToInvoiceButton`.
- **Factures** : Server Actions (`actions/invoices.ts`, `actions/invoice-items.ts`), pages liste et détail, composants `InvoicesTable`, `InvoiceForm`, `InvoiceItemsEditor`, `EditInvoiceItemDialog`, `InvoiceStatusActions`, `InvoiceAmountsCard`, `InvoiceBalanceCard`, `InvoicePaymentsList`, `RecordPaymentDialog`.
- **Paiements** : Server Actions (`actions/payments.ts`), liste globale avec filtres (`/admin/payments`), composant `PaymentsTable` (lecture seule).
- **Contrats de maintenance** : Server Actions (`actions/contracts.ts`), liste globale des contrats (`/admin/contracts`), composants dédiés. Gestion des modes de facturation `stripe_auto` et `manual_invoice`.
- **Rapports** : pages liste et génération (`/admin/reports`), stockage des fichiers sur Cloudflare R2, Server Actions (`actions/reports.ts`).
- **Tâches agents IA** : monitoring en temps réel des tâches (`/admin/agent-tasks`), API Route dédiée (`api/admin/agent-tasks/`), vue des logs et statuts.
- **Utilisateurs** : gestion des comptes admin et client (`/admin/users`), opérations ban/unban.
- **Profil admin** : édition du profil utilisateur (`/admin/profile`), mise à jour des informations personnelles.
- **Dashboard** : tableau de bord principal (`/admin`) avec graphiques analytiques — `MonthlyRevenueChart` (revenus mensuels) et `InvoiceStatusBreakdownChart` (ventilation des statuts de facturation). Données agrégées via `lib/dashboard/`.

Hook `use-data-table-state` partagé pour la gestion d'état des tableaux avec pagination, tri et filtres.

**R5 — En cours** : portail client en construction —

- **Compte** : page tableau de bord client (`/account`), layout `CustomerShell` + sidebar `CustomerSidebar` refactorisés.
- **Devis** : vue des devis du client (`/account/quotes`), lecture seule. Guards séquentiels : UUID valide → non-draft → ownership (non-divulgation 404). Voir `docs/customer-portal-quotes.md`.
- **Factures** : vue des factures du client (`/account/invoices`), lecture seule.
- **Rapports** : accès aux rapports de livraison (`/account/reports`) ; téléchargement PDF scopé via `GET /api/account/reports/[id]/file` (requireCustomer + guard issuedAt + guard ownership, non-divulgation 404). Voir `docs/customer-portal-reports.md`.
- **Profil & sécurité** : gestion du profil et des paramètres 2FA client (existants).

### Spike R2 — Stockage PDF (expérimental)

Un spike d'intégration Cloudflare R2 est en cours de validation (`apps/web/app/(admin)/admin/spike-upload/`). Il démontre :

- Upload PDF via Server Action avec validation des magic bytes (`%PDF`) et limite de taille (10 Mo)
- Stockage R2 sous le chemin `reports/YYYY/MM/<uuid>.pdf`
- Lecture en streaming via route handler authentifiée (`/admin/spike-upload/file?key=…`)
- Client R2 centralisé dans `apps/web/lib/storage/r2.ts` avec classes d'erreurs typées

> La route est accessible mais reste expérimentale jusqu'à intégration complète dans le module rapports.

### Services métier (`@saas/services`)

| Service | Responsabilité |
|---------|----------------|
| `auth.service` | Register, login, logout, vérification email, reset password |
| `email.service` | Envoi d'emails via Nodemailer (dev) ou Resend (prod) |
| `totp.service` | Génération et validation TOTP, codes de secours |
| `stripe.service` | Customer, checkout, portail, abonnements |
| `admin.service` | Opérations admin : liste utilisateurs, ban, gestion clients |
| `profile.service` | CRUD profil utilisateur |
| `client.service` | CRUD entités clients (company / individual), contacts |
| `project.service` | CRUD projets liés aux clients |
| `prestation.service` | CRUD catalogue de prestations (one-shot / recurring) |
| `quote.service` | Génération et gestion des devis |
| `invoice.service` | CRUD factures |
| `payment.service` | Enregistrement des paiements |
| `report.service` | Rapports de projet et de livraison |
| `maintenance-contract.service` | Contrats de maintenance récurrents (stripe_auto / manual_invoice) |

### Plans de facturation (pré-R3 — `config/plans.ts`)

| Plan | Prix | Membres | Agents IA | Workflows / mois |
|------|------|---------|-----------|------------------|
| Free | — | 3 | 1 | 10 |
| Pro | €29/mois | 10 | 5 | 100 |
| Business | €99/mois | Illimité | Illimité | Illimité |

> Ces plans seront refactorés lors du pivot R3 pour un modèle solo sans membres.

### RBAC — Matrice des permissions (`@saas/permissions`)

Deux rôles DB stricts : `admin` (propriétaire solo) et `client` (utilisateur final).

| Rôle | Ressources accessibles |
|------|------------------------|
| `admin` | Quote, Invoice, Report, Project, Prestation, Member, Invitation (gestion complète) |
| `client` | Quote, Invoice, Report, Project (lecture seule via portail client) |
<!-- END:features -->

<!-- SECTION:test-coverage -->
## Couverture de tests

### Tests unitaires et d'intégration (Vitest)

47 fichiers de tests couvrant les services critiques, les Server Actions et les composants UI :

**Packages**

| Fichier | Scope |
|---------|-------|
| `packages/config/src/__tests__/env.test.ts` | Validation variables d'env (Zod) |
| `packages/config/src/__tests__/stripe-sync.test.ts` | Synchronisation plans Stripe |
| `packages/db/src/__tests__/schema.test.ts` | Schéma Drizzle |
| `packages/permissions/src/__tests__/ability.test.ts` | CASL — rôles et permissions |
| `packages/services/src/__tests__/auth.service.test.ts` | Authentification |
| `packages/services/src/__tests__/totp.service.test.ts` | 2FA / TOTP |
| `packages/services/src/__tests__/stripe.service.test.ts` | Stripe billing |
| `packages/services/src/__tests__/admin.service.test.ts` | Opérations admin |
| `packages/services/src/__tests__/client.service.test.ts` | CRUD clients |
| `packages/services/src/__tests__/project.service.test.ts` | CRUD projets |
| `packages/services/src/__tests__/prestation.service.test.ts` | Catalogue prestations |
| `packages/services/src/__tests__/quote.service.test.ts` | Gestion devis |
| `packages/services/src/__tests__/invoice.service.test.ts` | Gestion factures |
| `packages/services/src/__tests__/payment.service.test.ts` | Enregistrement paiements |
| `packages/services/src/__tests__/report.service.test.ts` | Rapports |
| `packages/services/src/__tests__/maintenance-contract.service.test.ts` | Contrats de maintenance |
| `packages/services/src/__tests__/slug.test.ts` | Utilitaires slug |

**Web — lib, hooks & utilitaires**

| Fichier | Scope |
|---------|-------|
| `apps/web/lib/__tests__/action-result.test.ts` | Utilitaire action-result |
| `apps/web/lib/__tests__/auth.test.ts` | Helpers auth (session, guards) |
| `apps/web/lib/__tests__/format.test.ts` | Utilitaire format (dates, montants) |
| `apps/web/lib/__tests__/payment-labels.test.ts` | Labels et formatage des paiements |
| `apps/web/lib/__tests__/shadcn-imports.test.ts` | Intégrité des imports shadcn/ui |
| `apps/web/lib/__tests__/toast.test.ts` | Utilitaire toast (notifications) |
| `apps/web/lib/__tests__/use-data-table-state.test.tsx` | Hook état data-table (pagination, tri, filtres) |
| `apps/web/lib/schemas/__tests__/client.schemas.test.ts` | Validation schémas Zod client |
| `apps/web/lib/storage/__tests__/r2.test.ts` | Client R2 — upload, delete, stream PDF |
| `apps/web/components/billing/__tests__/billing-utils.test.ts` | Utilitaires billing |
| `apps/web/components/ui/__tests__/badge.test.tsx` | Composant Badge (variantes, rendu) |
| `apps/web/components/ui/data-table/__tests__/data-table.test.tsx` | Composant DataTable |
| `apps/web/components/layout/__tests__/` | Composants layout (CustomerShell, CustomerSidebar) |

**Web — composants dashboard**

| Fichier | Scope |
|---------|-------|
| `apps/web/components/dashboard/__tests__/` | Graphiques analytiques (MonthlyRevenueChart, InvoiceStatusBreakdownChart) |

**Web — page admin**

| Fichier | Scope |
|---------|-------|
| `apps/web/app/(admin)/admin/__tests__/` | Page dashboard admin (rendu, données, graphiques) |

**Web — Server Actions**

| Fichier | Scope |
|---------|-------|
| `apps/web/app/actions/__tests__/clients.test.ts` | Server Actions clients (CRUD) |
| `apps/web/app/actions/__tests__/prestations.test.ts` | Server Actions prestations (CRUD) |
| `apps/web/app/actions/__tests__/projects.test.ts` | Server Actions projets (CRUD) |
| `apps/web/app/actions/__tests__/quotes.test.ts` | Server Actions devis (CRUD) |
| `apps/web/app/actions/__tests__/quote-items.test.ts` | Server Actions lignes de devis |
| `apps/web/app/actions/__tests__/invoices.test.ts` | Server Actions factures (CRUD) |
| `apps/web/app/actions/__tests__/invoice-items.test.ts` | Server Actions lignes de facture |
| `apps/web/app/actions/__tests__/payments.test.ts` | Server Actions paiements |
| `apps/web/app/actions/__tests__/r2-legacy-purge.spec.ts` | Nettoyage fichiers R2 legacy |

```bash
pnpm test   # Exécute les 47 fichiers via vitest workspace
```

### Tests E2E (Playwright)

11 specs Playwright sur Chromium avec helpers partagés :

| Fichier | Scope |
|---------|-------|
| `tests/e2e/smoke.spec.ts` | Smoke test — pages accessibles, erreurs JS, redirections |
| `tests/e2e/multitenant.spec.ts` | Isolation multi-tenant (héritage R1) |
| `tests/e2e/projects.spec.ts` | Workflows CRUD projets admin |
| `tests/e2e/quotes.spec.ts` | Workflows devis — création, statuts, lignes |
| `tests/e2e/invoices.spec.ts` | Workflows factures — conversion, paiements, statuts |
| `tests/e2e/payments.spec.ts` | Workflows paiements — liste globale, filtres, enregistrement, lecture seule |
| `tests/e2e/contracts.spec.ts` | Workflows contrats de maintenance — création, statuts, facturation |
| `tests/e2e/reports.spec.ts` | Génération et téléchargement de rapports, stockage R2 |
| `tests/e2e/customer-quotes.spec.ts` | Portail client — isolation cross-client devis, guard draft, guard UUID |
| `tests/e2e/customer-invoices.spec.ts` | Portail client — isolation cross-client factures |
| `tests/e2e/customer-reports.spec.ts` | Portail client — isolation cross-client rapports, stream PDF |

Helpers E2E (`tests/e2e/helpers/`) :

| Fichier | Rôle |
|---------|------|
| `tests/e2e/helpers/auth.ts` | Authentification et session de test |
| `tests/e2e/helpers/data.ts` | Fixtures et création de données de test |
| `tests/e2e/helpers/contracts.ts` | Helpers dédiés aux contrats de maintenance |
| `tests/e2e/helpers/resolve-seed-ids.ts` | `resolveQuoteId` / `resolveInvoiceId` / `resolveReportId` — UUID réels depuis numéros seed |

```bash
pnpm test:e2e   # Requiert une DB Postgres active et le build Next.js
```

### Scripts de validation pivot

| Fichier | Scope |
|---------|-------|
| `tests/pivot-md.spec.sh` | Validation structure docs/PIVOT.md |
| `tests/pivot-r2-schema-0.spec.sh` | Validation nettoyage multi-tenant (R1) |
| `tests/turbo-config.spec.sh` | Validation configuration Turbo |

### CI/CD — GitHub Actions

Trois jobs sur chaque push et PR vers `main` / `develop` :

| Job | Étapes |
|-----|--------|
| `lint-typecheck` | ESLint · TypeScript · drizzle-kit check |
| `unit-tests` | Vitest (workspace complet) |
| `e2e-tests` | Service Postgres · migrations · Playwright smoke |
<!-- END:test-coverage -->

<!-- SECTION:backlog -->
## Backlog

Aucun répertoire de backlog structuré (`backlog/todo/`, `backlog/in-progress/`, `backlog/done/`) n'est présent dans ce projet.

Le suivi des tâches est géré via :

- `docs/PIVOT.md` — Résumé exécutif du pivot (mai 2026), roadmap R1–R7, décisions D1–D5
- `docs/pivot-document.md` — Analyse complète : diagnostic, domaine cible, décisions d'architecture, stratégie de migration DB, roadmap d'implémentation
- `docs/pivot-r3-architecture.md` — Architecture détaillée du module Stripe Billing solo (R3)
- `docs/roadmap-r3.md` — Décomposition en sous-tâches (ST1–ST11) avec phases détaillées
- `agency-state/reports/` — Rapports générés par le swarm d'agents (design, impl, QA, security) classés par date
<!-- END:backlog -->

<!-- SECTION:configuration -->
## Configuration

### Variables d'environnement

Copier `.env.example` en `.env` et renseigner toutes les valeurs :

```env
# Base de données
DATABASE_URL="postgresql://postgres:password@localhost:5432/saas"

# Application
NODE_ENV="development"
PORT="3001"
APP_URL="http://localhost:3001"

# Sessions
SESSION_SECRET="<secret-32-chars-minimum>"

# Emails (MailHog en développement)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
RESEND_API_KEY="<clé-resend-pour-prod>"

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# 2FA
TOTP_ISSUER="SaaS Agentique"

# Stockage R2 / Cloudflare (requis pour le module rapports)
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="<r2-access-key>"
R2_SECRET_ACCESS_KEY="<r2-secret-key>"
R2_BUCKET_NAME="<nom-du-bucket>"
```

### Infrastructure locale

PostgreSQL via Docker Compose :

```bash
docker compose -f infra/docker-compose.yml up -d
```

| Paramètre | Valeur |
|-----------|--------|
| Image | `postgres:15-alpine` |
| Port exposé | `5466` → `5432` |
| Base | `saas` |
| Utilisateur | `postgres` |
| Mot de passe | `password` |

### Turbo — cache et dépendances de build

```json
{
  "build":       { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
  "lint":        { "dependsOn": ["^lint"] },
  "check-types": { "dependsOn": ["^check-types"] },
  "test":        { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
  "dev":         { "cache": false, "persistent": true }
}
```

### Next.js — limites Server Actions

`next.config.ts` configure une limite de 12 Mo pour les Server Actions afin de permettre l'upload de fichiers PDF :

```typescript
experimental: {
  serverActions: {
    bodySizeLimit: "12mb",
  },
},
```
<!-- END:configuration -->
