# SaaS Agentique

Boilerplate SaaS avec stack agentique IA. Architecture monorepo Turborepo, authentification complète maison (email + sessions + 2FA/OTP), RBAC CASL, billing Stripe, workflows Inngest et agents IA via Vercel AI SDK + Claude.

> **Pivot en cours (mai 2026)** — Le projet passe d'un modèle SaaS multi-tenant B2B vers un modèle freelance solo-admin (clients, projets, devis, factures). R1 (suppression multi-tenant) est complété. R2 (nouveau schéma domaine + services clients/prestations) est en cours. Tag de rollback : `pre-pivot-v1`. Voir `docs/PIVOT.md` pour le contexte complet.

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
| `@saas/services` | Business logic (auth, admin, stripe, TOTP, email, profil, client, prestation) |
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
```

### Structure du monorepo

```
sass-agentique/
├── apps/
│   └── web/                      # Application Next.js 15 (port 3001)
│       ├── app/
│       │   ├── (marketing)/      # Landing page publique
│       │   ├── (auth)/           # Login, register, 2FA, reset password
│       │   ├── (app)/            # Application authentifiée (onboarding)
│       │   ├── (admin)/          # Backoffice admin
│       │   └── api/
│       │       ├── billing/      # checkout, portail client
│       │       └── webhooks/stripe/
│       ├── components/           # Composants React (admin, auth, billing, dashboard…)
│       ├── hooks/                # useAbility (CASL)
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
│   └── pivot-document.md         # Analyse complète + roadmap R1–R7
├── scripts/                      # stripe-sync et utilitaires
├── tests/
│   └── e2e/                      # Specs Playwright
├── infra/
│   └── docker-compose.yml        # PostgreSQL 15 (port 5466)
└── .github/
    └── workflows/ci.yml          # 3 jobs : lint · unit · e2e
```

### Schéma de base de données (état post-R2 partiel)

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
                     email, phone, billing_address (JSONB), notes
client_contacts    — id, client_id (FK), user_id (FK) — pivot N-N
projects           — id, client_id (FK), slug, name,
                     status (draft|active|on_hold|delivered|cancelled),
                     timeline_start, timeline_end
prestations        — id, slug, name, kind (one_shot|recurring),
                     base_price_eur_cents, sort_order
quotes             — id, client_id (FK), project_id (FK, opt.), number,
                     status (draft|sent|accepted|declined|expired),
                     issued_at, expires_at, total_eur_cents
quote_items        — id, quote_id (FK), prestation_id (FK, opt.),
                     description, quantity, unit_price_eur_cents, sort_order
invoices           — id, client_id (FK), quote_id (FK, opt.), number,
                     status (draft|sent|paid|overdue|cancelled), total_eur_cents
invoice_items      — id, invoice_id (FK), description, quantity, unit_price_eur_cents
payments           — id, invoice_id (FK), amount_eur_cents,
                     method (stripe_card|bank_transfer|other), paid_at
reports            — id, client_id (FK), project_id (FK, opt.), kind, content
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
| 5 | Stripe Billing (plans, webhooks, portail client) | 🔄 En cours |
| 6 | Inngest Workflows (events, CRONs) | — |
| 7 | Admin Backoffice | 🔄 En cours |
| 8 | Stack Agentique IA (BaseAgent, outils) | — |
| 9 | Tests & Qualité (coverage 80%+) | — |
| 10 | CI/CD & Déploiement (Vercel + Railway) | — |
| 11 | Landing Page & GTM | — |

### Pivot mai 2026 — Roadmap freelance (R1–R7)

Le projet pivote vers un modèle solo-admin sans multi-tenant. Voir `docs/pivot-document.md`.

| Phase | Objectif | Durée estimée | Statut |
|-------|---------|---------------|--------|
| R1 | Suppression multi-tenant (services, schéma, UI) | 1 semaine | ✅ Fait |
| R2 | Nouveau schéma + services : clients, projets, devis, factures | 1 semaine | 🔄 En cours |
| R3 | Refonte Stripe Billing (solo) | 1 semaine | — |
| R4 | Modules métier admin : clients & projets | 1–2 semaines | — |
| R5 | Devis & Factures | 1–2 semaines | — |
| R6 | Stack agentique IA (pipeline client) | 2 semaines | — |
| R7 | CI/CD, déploiement, landing | 1 semaine | — |

**R1 — Complété** : services multi-tenant supprimés (tenant, invitation, membership, subscription), schéma DB simplifié, composants UI nettoyés.

**R2 — En cours** : schéma du domaine freelance migré (clients, projets, prestations, devis, factures, paiements, rapports). Services `client.service.ts` et `prestation.service.ts` ajoutés et exposés via `@saas/services`.

### Services métier (`@saas/services`)

| Service | Responsabilité |
|---------|----------------|
| `auth.service` | Register, login, logout, vérification email, reset password |
| `email.service` | Envoi d'emails via Nodemailer (dev) ou Resend (prod) |
| `totp.service` | Génération et validation TOTP, codes de secours |
| `stripe.service` | Customer, checkout, portail, abonnements |
| `admin.service` | Opérations admin : liste utilisateurs, ban, gestion clients |
| `profile.service` | CRUD profil utilisateur |
| `client.service` | CRUD entités clients (company / individual) |
| `prestation.service` | CRUD catalogue de prestations (one-shot / recurring) |

### Plans de facturation (pré-pivot — `config/plans.ts`)

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

11 fichiers de tests couvrant les services critiques :

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
| `packages/services/src/__tests__/slug.test.ts` | Utilitaires slug |
| `apps/web/components/billing/__tests__/billing-utils.test.ts` | Utilitaires billing (UI) |
| `apps/web/app/api/billing/portal/__tests__/route.test.ts` | Route API portail |

```bash
pnpm test   # Exécute les 11 fichiers via vitest workspace
```

### Tests E2E (Playwright)

2 specs Playwright sur Chromium :

| Fichier | Scope |
|---------|-------|
| `tests/e2e/smoke.spec.ts` | Smoke test — pages accessibles |
| `tests/e2e/multitenant.spec.ts` | Isolation multi-tenant (héritage) |

```bash
pnpm test:e2e   # Requiert une DB Postgres active et le build Next.js
```

### Scripts de validation pivot

| Fichier | Scope |
|---------|-------|
| `tests/pivot-md.spec.sh` | Validation structure docs/PIVOT.md |
| `tests/pivot-r2-schema-0.spec.sh` | Validation nettoyage multi-tenant (R1) |

### CI/CD — GitHub Actions

Trois jobs sur chaque push et PR vers `main` / `develop` :

| Job | Étapes |
|-----|--------|
| `lint-typecheck` | ESLint · TypeScript · drizzle-kit check |
| `unit-tests` | Vitest (`@saas/config` + `@saas/db`) |
| `e2e-tests` | Service Postgres · migrations · Playwright smoke |
<!-- END:test-coverage -->

<!-- SECTION:backlog -->
## Backlog

Aucun répertoire de backlog structuré (`backlog/todo/`, `backlog/in-progress/`, `backlog/done/`) n'est présent dans ce projet.

Le suivi des tâches est géré via :

- `saas-swarm-plan.md` — Plan de développement Swarm détaillé (phases 0–11)
- `docs/PIVOT.md` — Résumé exécutif du pivot (mai 2026), roadmap R1–R7, décisions D1–D5
- `docs/pivot-document.md` — Analyse complète : diagnostic, domaine cible, décisions d'architecture, stratégie de migration DB, roadmap d'implémentation
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
<!-- END:configuration -->
