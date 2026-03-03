# SaaS Agentique

Boilerplate SaaS multi-tenant avec stack agentique IA. Architecture monorepo Turborepo, authentification complète (email + 2FA/OTP), RBAC CASL, billing Stripe, workflows Inngest et agents IA via Vercel AI SDK + Claude.

## Stack

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 15 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS v4 + Radix |
| Auth | Supabase Auth + NextAuth v5 |
| 2FA/OTP | `otplib` (TOTP RFC 6238) + QR code |
| RBAC | CASL v6 |
| ORM | Drizzle ORM |
| Base de données | PostgreSQL (Supabase ou self-hosted) |
| Paiements | Stripe (abonnements + webhooks) |
| Workflows | Inngest |
| Agents IA | Vercel AI SDK + Anthropic Claude API |
| Emails | Resend + React Email |
| Monorepo | Turborepo + pnpm workspaces |
| Tests | Vitest (unit/integ) + Playwright (e2e) |
| CI/CD | GitHub Actions |

## Prérequis

- Node.js v20+
- pnpm v9.1.1+
- Docker (pour Postgres local)

## Démarrage rapide

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

# 5. Lancer le serveur de développement
pnpm dev
```

L'application est disponible sur [http://localhost:3000](http://localhost:3000).

## Structure du monorepo

```
sass-agentique/
├── apps/
│   └── web/                  # Application Next.js 15
│       ├── app/
│       │   ├── (marketing)/  # Landing page publique
│       │   ├── (auth)/       # Login, register, forgot password
│       │   ├── (app)/        # Application authentifiée
│       │   ├── (admin)/      # Backoffice admin
│       │   └── api/          # API Routes
│       └── middleware.ts     # Auth guard + résolution tenant
├── packages/
│   ├── config/               # Validation env vars (Zod)
│   ├── db/                   # Drizzle ORM + schema + migrations
│   ├── services/             # Business logic (auth, stripe, tenant…)
│   ├── permissions/          # CASL RBAC (rôles × actions × ressources)
│   ├── workflows/            # Inngest jobs et CRONs
│   ├── agents/               # Stack agentique (BaseAgent, tools)
│   └── ui/                   # Design system partagé (shadcn/ui)
├── tests/
│   └── e2e/                  # Tests Playwright
├── infra/
│   └── docker-compose.yml    # Postgres local
└── .github/
    └── workflows/ci.yml      # CI : lint · typecheck · unit · e2e
```

## Variables d'environnement

Copier `.env.example` en `.env` et renseigner :

```env
# Base de données
DATABASE_URL="postgresql://postgres:password@localhost:5432/saas"

# App
NODE_ENV="development"
PORT="3000"
```

Les phases suivantes ajouteront : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `INNGEST_SIGNING_KEY`, `ANTHROPIC_API_KEY`.

## Schéma de base de données

```
tenants       — id, slug, name, plan, stripe_customer_id
users         — id, email, hashed_password, totp_secret, role
memberships   — user_id, tenant_id, role (OWNER/ADMIN/MEMBER/VIEWER)
sessions      — user_id, session_token, expires
agent_tasks   — tenant_id, agent_type, status, payload, result
agent_logs    — task_id, level, message
```

Toutes les tables métier incluent `tenant_id` — Row-Level Security Supabase prêt à activer.

## Commandes utiles

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
```

## CI/CD

Trois jobs GitHub Actions sur chaque push et PR :

| Job | Étapes |
|-----|--------|
| `lint-typecheck` | ESLint · TypeScript · drizzle-kit check |
| `unit-tests` | Vitest (`@saas/config` + `@saas/db`) |
| `e2e-tests` | Postgres service · migrations · Playwright smoke |

## Roadmap

| Phase | Feature | Statut |
|-------|---------|--------|
| 0 | Fondations (monorepo, DB, CI, Next.js) | ✅ Fait |
| 1 | Auth Core (Supabase Auth, sessions, emails) | ✅ Fait |
| 2 | Multi-tenant (workspaces, invitations, RLS) | ✅ Fait |
| 3 | RBAC CASL (rôles, guards serveur + client) | ✅ Fait |
| 4 | 2FA / OTP (TOTP, backup codes) | — |
| 5 | Stripe Billing (plans, webhooks, portail) | — |
| 6 | Inngest Workflows (events, CRONs) | — |
| 7 | Admin Backoffice | — |
| 8 | Stack Agentique IA (BaseAgent, Calendar, Mail) | — |
| 9 | Tests & Qualité (coverage 80%+) | — |
| 10 | CI/CD & Déploiement (Vercel + Railway) | — |
| 11 | Landing Page & GTM | — |

## Architecture

```
UI (Next.js)
    ↓  Server Actions / API Routes
Services (@saas/services)
    ↓  Drizzle queries (tenantId obligatoire)
DB (@saas/db) — PostgreSQL
```

Règles strictes (voir `CLAUDE.md`) :
- Les composants React ne font jamais d'appels Drizzle directs
- Les services n't importent jamais React
- Le `tenantId` est obligatoire dans toutes les queries DB
- Les agents étendent `BaseAgent` et loggent chaque tool call
