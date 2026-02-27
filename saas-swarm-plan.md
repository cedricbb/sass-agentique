# 🤖 SaaS Agentique — Plan Swarm

> Stack : Next.js 15 · TypeScript · Supabase · Drizzle · Postgres · CASL · 2FA/OTP · Stripe · Inngest · Multi-tenant · AI Agents · CI/CD
>
> Ce fichier est la version **swarm-ready** de la roadmap. Chaque phase = un feature slug `.swarm/features/<slug>/`.

---

## 🚀 INITIALISATION DU PROJET

```bash
# 1. Créer le projet et se positionner dedans
mkdir ~/work/my-saas && cd ~/work/my-saas
git init

# 2. Créer le CLAUDE.md (lu par tous les agents)
touch CLAUDE.md

# 3. Lancer le swarm depuis le projet
swarm team dev-team --model claude

# 4. Voir le standup en temps réel (depuis host, n'importe où)
swarm daily
```

> **Règle d'or :** chaque agent ouvre son tmux window et fait `swarm-log daily` en premier.

---

## 👥 MATRICE DES AGENTS

| Agent | Icône | Responsabilités dans ce projet |
|-------|-------|--------------------------------|
| PM | 🧭 | Specs features, user stories, OKRs, priorisation backlog |
| Architect | 🏗️ | ADRs, schéma DB, structure monorepo, turborepo config |
| Dev-Back | ⚙️ | APIs, services, Drizzle schema, Supabase, Stripe, Inngest |
| Dev-Front | 🎨 | Pages Next.js, composants, Server Actions, useChat |
| QA | 🧪 | Test plans, Vitest, Playwright, review PR |
| UI/UX | ✏️ | Maquettes shadcn/ui, design system, user flows, mockups |

**Parallélisation :** Back + Front + UI/UX travaillent toujours en parallèle.
Back (schema/API) → Front (UI sur l'API) → QA (valide les deux).

---

## 📁 STRUCTURE DU PROJET

```
my-saas/
├── CLAUDE.md                             ← Lu par tous les agents swarm
├── .swarm/                               ← Traceabilité swarm (auto-généré)
│   ├── daily/YYYY-MM-DD/<role>.md
│   ├── features/<slug>/<role>.md
│   └── status.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── e2e.yml
│       └── deploy.yml
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (marketing)/
│       │   ├── (auth)/
│       │   ├── (app)/
│       │   ├── (admin)/
│       │   └── api/
│       ├── components/
│       └── middleware.ts
├── packages/
│   ├── db/                               ← Drizzle ORM
│   ├── services/                         ← Business logic
│   ├── permissions/                      ← CASL RBAC
│   ├── workflows/                        ← Inngest
│   ├── agents/                           ← Stack agentique
│   ├── ui/                               ← Design system partagé
│   └── config/                           ← Env vars + plans Stripe
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── infra/
│   ├── docker-compose.yml
│   └── supabase/config.toml
├── package.json                          ← turborepo root
├── turbo.json
└── tsconfig.json
```

---

## 📋 CLAUDE.md (à créer à la racine du projet)

```markdown
# SaaS Agentique — Rules pour agents swarm

## Architecture — 3 couches strictes
- UI → Service → Persistence (jamais de cross-layer)
- Les composants React ne font JAMAIS d'appels Drizzle directs
- Les services ne font JAMAIS d'import React
- Les mutations passent par Server Actions ou API Routes dédiées
- Toujours inclure tenantId dans les queries DB

## Naming conventions
- Services : [domain].service.ts (ex: stripe.service.ts)
- Events Inngest : [domain].[action] (ex: user.created)
- Schema Drizzle : snake_case pour les colonnes
- Components : PascalCase, un composant par fichier
- Hooks : useXxx
- Agent tools : [verb]-[noun].tool.ts

## Agents
- Chaque agent étend BaseAgent
- Les tools sont injectés, pas importés directement
- Toujours logger le début et fin de chaque tool call
- Le contexte tenant EST OBLIGATOIRE dans chaque agent task
- Les résultats d'agents sont persistés en DB avant retour

## Tests
- Coverage 80%+ sur les services
- Chaque service a son fichier de test correspondant
- Tests Playwright pour les flows critiques (auth, billing, agents)

## Swarm workflow
- Chaque feature = un slug dans .swarm/features/<slug>/
- Toujours `swarm-log daily` en début de session
- Toujours `swarm-log feature <slug>` en début de feature
- Les blockers sont nommés explicitement dans le standup
```

---

## 🗄️ SCHÉMA DB MULTI-TENANT (Drizzle)

```
tenants          — id, slug, name, plan, stripeCustomerId
users            — id, email, hashedPassword, totpSecret, role
memberships      — userId, tenantId, role (OWNER/ADMIN/MEMBER/VIEWER)
sessions         — standard NextAuth
plans            — id, name, stripeProductId, stripePriceId, features (json)
subscriptions    — tenantId, planId, stripeSubscriptionId, status
agent_tasks      — id, tenantId, agentType, status, payload, result
agent_logs       — taskId, level, message, createdAt
```

> Toutes les tables métier ont `tenant_id` → Row-Level Security Supabase

---

## 🧱 TECH STACK

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 15 App Router + TypeScript strict |
| UI | shadcn/ui + Tailwind CSS v4 + Radix primitives |
| Auth | Supabase Auth + NextAuth v5 adapter |
| 2FA/OTP | `otplib` (TOTP RFC 6238) + QR code |
| RBAC | CASL v6 (`@casl/ability` + `@casl/react`) |
| ORM | Drizzle ORM |
| DB | PostgreSQL (Supabase hosted ou self-hosted) |
| Storage | Supabase Storage Buckets |
| Payments | Stripe (subscriptions + one-time + webhooks) |
| Workflows | Inngest (events, jobs, CRON) |
| Agents IA | Vercel AI SDK + Anthropic Claude API |
| Email | Resend + React Email |
| Monorepo | Turborepo + pnpm workspaces |
| Tests | Vitest (unit/integ) + Playwright (e2e) |
| CI/CD | GitHub Actions → Vercel (app) + Railway (DB) |
| Observability | Sentry + Axiom logs |

---

## 📋 ROADMAP PAR FEATURE

---

### PHASE 0 — FONDATIONS
> Feature slug : `foundations` | Branche : `feat/foundations`

```bash
swarm team dev-team --model claude
# Dans chaque window :
swarm-log feature foundations
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 0.1 | Init Turborepo + pnpm workspaces | 🏗️ Architect | `/design` |
| 0.2 | Package `config` + validation env Zod | ⚙️ Dev-Back | `/schema` |
| 0.3 | Drizzle setup + schema `auth` + `tenants` + migrations | ⚙️ Dev-Back | `/schema` |
| 0.4 | Docker Compose Postgres local + Supabase CLI | 🏗️ Architect | — |
| 0.5 | CI GitHub Actions (lint + typecheck + drizzle-kit check) | 🏗️ Architect | — |
| 0.6 | Init Next.js app + layout root + middleware squelette | 🎨 Dev-Front | `/page` |
| 0.7 | Créer `CLAUDE.md` à la racine (règles pour les agents) | 🧭 PM | `/kickoff` |

**Parallèles :** 0.1 → {0.2, 0.3 en séquence} + {0.4, 0.5 en parallèle} + {0.6}

**Livrables :** `pnpm dev` fonctionne, DB migrée, CI vert sur push

---

### PHASE 1 — AUTH CORE
> Feature slug : `auth-core` | Branche : `feat/auth-core`

```bash
swarm-log feature auth-core
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 1.1 | Intégration Supabase Auth (email/password) | ⚙️ Dev-Back | `/auth` |
| 1.2 | Service `auth.service.ts` (register, login, logout, refresh) | ⚙️ Dev-Back | `/auth` |
| 1.3 | Middleware auth guard → redirect si non connecté | ⚙️ Dev-Back | `/auth` |
| 1.4 | Pages : Login, Register, Forgot/Reset Password | 🎨 Dev-Front | `/page` |
| 1.5 | Maquettes auth flows (login, register, forgot) | ✏️ UI/UX | `/wireframe` |
| 1.6 | Email de vérification (Resend + React Email template) | ⚙️ Dev-Back | `/api` |
| 1.7 | Gestion sessions (cookie sécurisé, CSRF) | ⚙️ Dev-Back | `/auth` |
| 1.8 | Tests Vitest sur `auth.service.ts` | 🧪 QA | `/test-back` |
| 1.9 | Spec feature auth (user stories, critères d'acceptance) | 🧭 PM | `/spec` |

**Parallèles :** 1.1→1.2→1.3 (back) ‖ 1.5→1.4 (ui-ux → front) ‖ 1.9 (pm)
**Bloquants :** 1.8 bloqué par 1.1+1.2

---

### PHASE 2 — MULTI-TENANT
> Feature slug : `multi-tenant` | Branche : `feat/multi-tenant`

```bash
swarm-log feature multi-tenant
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 2.1 | ADR : stratégie multi-tenant (subdomain vs header vs path) | 🏗️ Architect | `/adr` |
| 2.2 | Schema Drizzle `tenants` + `memberships` | ⚙️ Dev-Back | `/schema` |
| 2.3 | Création auto tenant à l'inscription (personal workspace) | ⚙️ Dev-Back | `/api` |
| 2.4 | Middleware tenant : résolution par subdomain ou header | ⚙️ Dev-Back | `/auth` |
| 2.5 | `TenantContext` React (hook `useTenant`) | 🎨 Dev-Front | `/component` |
| 2.6 | Row-Level Security Supabase sur toutes les tables métier | ⚙️ Dev-Back | `/schema` |
| 2.7 | Service `tenant.service.ts` + `membership.service.ts` | ⚙️ Dev-Back | `/api` |
| 2.8 | Invitation de membres par email | ⚙️ Dev-Back | `/api` |
| 2.9 | Tests isolation tenant (cross-tenant leak tests) | 🧪 QA | `/test-back` |

**Bloquants :** 2.1 → tous | 2.2 → 2.3, 2.6, 2.7

---

### PHASE 3 — RBAC / CASL
> Feature slug : `rbac-casl` | Branche : `feat/rbac-casl`

```bash
swarm-log feature rbac-casl
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 3.1 | ADR : modèle de permissions (rôles × actions × ressources) | 🏗️ Architect | `/adr` |
| 3.2 | Package `permissions` — rôles (ADMIN, OWNER, MEMBER, VIEWER, AGENT) | ⚙️ Dev-Back | `/schema` |
| 3.3 | `defineAbility(user, tenant)` → rules CASL | ⚙️ Dev-Back | `/auth` |
| 3.4 | Guard serveur `canOrThrow(ability, action, subject)` | ⚙️ Dev-Back | `/auth` |
| 3.5 | Hook `useAbility()` côté client | 🎨 Dev-Front | `/component` |
| 3.6 | UI conditionnelle basée sur permissions (boutons, menus) | 🎨 Dev-Front | `/component` |
| 3.7 | Tests unitaires CASL (toutes combinaisons rôle × action) | 🧪 QA | `/test-back` |

**Bloquants :** 3.1 → tous | Phase 2 doit être terminée

---

### PHASE 4 — 2FA / OTP
> Feature slug : `2fa-otp` | Branche : `feat/2fa-otp`

```bash
swarm-log feature 2fa-otp
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 4.1 | Service `totp.service.ts` (enable, disable, verify, backup codes) | ⚙️ Dev-Back | `/auth` |
| 4.2 | Génération secret TOTP + QR code | ⚙️ Dev-Back | `/api` |
| 4.3 | Backup codes (10 codes single-use, stockés hashés en DB) | ⚙️ Dev-Back | `/auth` |
| 4.4 | Maquette page `/settings/security` | ✏️ UI/UX | `/wireframe` |
| 4.5 | Page `/settings/security` (activation 2FA + QR) | 🎨 Dev-Front | `/page` |
| 4.6 | Page `/verify-otp` (flow login post-password) | 🎨 Dev-Front | `/page` |
| 4.7 | Test e2e Playwright : flow 2FA complet | 🧪 QA | `/e2e` |
| 4.8 | Indicateur 2FA dans admin | 🎨 Dev-Front | `/component` |

**Peut tourner en parallèle de Phase 5 (Stripe)**

---

### PHASE 5 — STRIPE + BILLING
> Feature slug : `stripe-billing` | Branche : `feat/stripe-billing`

```bash
swarm-log feature stripe-billing
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 5.1 | Spec billing : définir les plans (Free/Pro/Business) | 🧭 PM | `/spec` |
| 5.2 | Schema Drizzle `plans` + `subscriptions` | ⚙️ Dev-Back | `/schema` |
| 5.3 | Plans dans `config/plans.ts` + Stripe Products/Prices sync | ⚙️ Dev-Back | `/api` |
| 5.4 | Service `stripe.service.ts` + `subscription.service.ts` | ⚙️ Dev-Back | `/api` |
| 5.5 | Webhook Stripe (created, updated, deleted, payment_failed) | ⚙️ Dev-Back | `/api` |
| 5.6 | Checkout Session (abonnement + one-time) | ⚙️ Dev-Back | `/api` |
| 5.7 | Customer Portal Stripe (self-serve) | ⚙️ Dev-Back | `/api` |
| 5.8 | Maquette page Pricing + Billing dashboard | ✏️ UI/UX | `/mockup` |
| 5.9 | Page Pricing publique + logique `can upgrade` | 🎨 Dev-Front | `/page` |
| 5.10 | Page `/settings/billing` avec statut abonnement | 🎨 Dev-Front | `/page` |
| 5.11 | Feature flags basés sur plan (middleware ou hook `usePlan`) | ⚙️ Dev-Back | `/api` |
| 5.12 | Tests : simulation webhooks Stripe CLI | 🧪 QA | `/test-back` |

**Parallèles :** 5.1→5.2→5.3→5.4 (back) ‖ 5.8→5.9,5.10 (ui-ux → front)
**Bloquants :** 5.5 bloqué par 5.4

---

### PHASE 6 — INNGEST WORKFLOWS
> Feature slug : `inngest-workflows` | Branche : `feat/inngest-workflows`

```bash
swarm-log feature inngest-workflows
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 6.1 | ADR : Inngest vs alternatives (BullMQ, etc.) | 🏗️ Architect | `/adr` |
| 6.2 | Setup package `workflows` + endpoint `/api/inngest` | ⚙️ Dev-Back | `/api` |
| 6.3 | Events : `user.created`, `user.deleted`, `subscription.updated`, `agent.task.queued` | ⚙️ Dev-Back | `/api` |
| 6.4 | Function : `welcome-email` (trigger: user.created) | ⚙️ Dev-Back | `/api` |
| 6.5 | Function : `stripe-sync` (trigger: subscription.updated) | ⚙️ Dev-Back | `/api` |
| 6.6 | CRON : `daily-digest` — résumé quotidien | ⚙️ Dev-Back | `/api` |
| 6.7 | CRON : `mail-check` — placeholder agent mail | ⚙️ Dev-Back | `/api` |
| 6.8 | Dev : Inngest DevServer local | ⚙️ Dev-Back | — |

---

### PHASE 7 — ADMIN BACKOFFICE
> Feature slug : `admin-backoffice` | Branche : `feat/admin-backoffice`

```bash
swarm-log feature admin-backoffice
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 7.1 | Maquette dashboard admin (stats, tables, actions) | ✏️ UI/UX | `/dashboard` |
| 7.2 | Route group `(admin)` avec guard role=ADMIN | ⚙️ Dev-Back | `/auth` |
| 7.3 | Dashboard admin : stats (users, MRR, tenants actifs) | 🎨 Dev-Front | `/page` |
| 7.4 | Table Users : liste, search, ban/unban, reset 2FA | 🎨 Dev-Front | `/component` |
| 7.5 | Table Tenants : liste, plan actuel, changer plan | 🎨 Dev-Front | `/component` |
| 7.6 | Table Subscriptions : statut, annuler, rembourser | 🎨 Dev-Front | `/component` |
| 7.7 | Logs agent_tasks en temps réel | 🎨 Dev-Front | `/component` |
| 7.8 | Seed data pour développement | ⚙️ Dev-Back | `/schema` |
| 7.9 | Test plan admin (permissions, data isolation) | 🧪 QA | `/test-plan` |

**Bloquants :** 7.1 → 7.3,7.4,7.5,7.6 | Phase 3 (RBAC) doit être terminée

---

### PHASE 8 — STACK AGENTIQUE
> Feature slug : `ai-agents` | Branche : `feat/ai-agents`

```bash
swarm-log feature ai-agents
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 8.1 | ADR : architecture agents (BaseAgent, Tool Registry, context tenant) | 🏗️ Architect | `/adr` |
| 8.2 | Package `agents` — `BaseAgent` class + interface `Tool` | ⚙️ Dev-Back | `/api` |
| 8.3 | Tool Registry + injection dépendances (context tenant) | ⚙️ Dev-Back | `/api` |
| 8.4 | Agent Calendar : tools `listEvents`, `createEvent`, `findFreeSlot` | ⚙️ Dev-Back | `/api` |
| 8.5 | Agent Mail : tools `checkInbox`, `classifyUrgency`, `draftReply` | ⚙️ Dev-Back | `/api` |
| 8.6 | Intégration swarm de dev via orchestrateur | ⚙️ Dev-Back | `/api` |
| 8.7 | Persistence tâches agents en DB (`agent_tasks`) | ⚙️ Dev-Back | `/schema` |
| 8.8 | Maquette UI AgentChat + AgentStatus dashboard | ✏️ UI/UX | `/dashboard` |
| 8.9 | Composant `AgentChat` + streaming (Vercel AI SDK `useChat`) | 🎨 Dev-Front | `/component` |
| 8.10 | Composant `AgentStatus` dashboard | 🎨 Dev-Front | `/component` |
| 8.11 | Quota agents par plan Stripe | ⚙️ Dev-Back | `/api` |
| 8.12 | Test plan agents (timeouts, erreurs, quotas) | 🧪 QA | `/test-plan` |

**Parallèles :** 8.2→8.3→8.4,8.5,8.6 (back) ‖ 8.8→8.9,8.10 (ui-ux → front)
**Bloquants :** Phase 6 (Inngest) doit être terminée

---

### PHASE 9 — TESTS & QUALITÉ
> Feature slug : `tests-quality` | Branche : `feat/tests-quality` (continu dès Phase 1)

```bash
swarm-log feature tests-quality
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 9.1 | Vitest config + coverage 80%+ sur les services | 🧪 QA | `/coverage` |
| 9.2 | Tests intégration API routes | 🧪 QA | `/test-back` |
| 9.3 | Playwright : flow auth complet (register → 2FA → login) | 🧪 QA | `/e2e` |
| 9.4 | Playwright : flow billing (checkout → webhook → access granted) | 🧪 QA | `/e2e` |
| 9.5 | Playwright : flow agent mail (notification mail urgent) | 🧪 QA | `/e2e` |
| 9.6 | Test seed factory (drizzle fixtures réutilisables) | ⚙️ Dev-Back | `/schema` |
| 9.7 | Review QA finale avant déploiement | 🧪 QA | `/review-qa` |

---

### PHASE 10 — CI/CD & DÉPLOIEMENT
> Feature slug : `cicd-deploy` | Branche : `feat/cicd-deploy`

```bash
swarm-log feature cicd-deploy
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 10.1 | ADR : stratégie déploiement (Vercel + Railway vs Railway full) | 🏗️ Architect | `/adr` |
| 10.2 | GitHub Actions : lint → typecheck → tests → build | 🏗️ Architect | — |
| 10.3 | GitHub Actions : e2e Playwright (sur PR vers main) | 🏗️ Architect | — |
| 10.4 | GitHub Actions : migration DB automatique au deploy | 🏗️ Architect | — |
| 10.5 | Deploy Vercel (app Next.js) + variables d'env | 🏗️ Architect | — |
| 10.6 | DB prod : Supabase project (ou Railway Postgres) | 🏗️ Architect | — |
| 10.7 | Sentry : erreurs prod + performance monitoring | ⚙️ Dev-Back | — |
| 10.8 | Axiom/Logtail : logs structurés | ⚙️ Dev-Back | — |
| 10.9 | Alerts : Stripe webhook monitoring, agent failures | ⚙️ Dev-Back | — |

---

### PHASE 11 — LANDING PAGE & GTM
> Feature slug : `landing-page` | Branche : `feat/landing-page`

```bash
swarm-log feature landing-page
```

| # | Tâche | Agent | Skill |
|---|-------|-------|-------|
| 11.1 | Spec GTM : personas, value prop, pricing positioning | 🧭 PM | `/spec` |
| 11.2 | Maquette landing page (hero, features, pricing, testimonials) | ✏️ UI/UX | `/mockup` |
| 11.3 | Landing page `/` (hero, features, pricing, CTA) | 🎨 Dev-Front | `/page` |
| 11.4 | SEO : metadata, sitemap, robots.txt | 🎨 Dev-Front | `/page` |
| 11.5 | Blog (MDX) pour le contenu | 🎨 Dev-Front | `/page` |
| 11.6 | Waitlist / early access form | 🎨 Dev-Front | `/component` |
| 11.7 | Cookie consent (RGPD) | 🎨 Dev-Front | `/component` |
| 11.8 | Analytics : Plausible ou PostHog (privacy-first) | ⚙️ Dev-Back | — |

---

## 🎯 ORDRE D'EXÉCUTION

```
Phase 0 (Fondations)
    ↓
Phase 1 (Auth) + Phase 2 (Multi-tenant) — séquentiels
    ↓
Phase 3 (RBAC) — bloqué par Phase 2
    ↓
Phase 4 (2FA) ‖ Phase 5 (Stripe) — parallèles
    ↓
Phase 6 (Inngest) — bloqué par Phase 5
    ↓
Phase 7 (Admin) — bloqué par Phase 3
    ↓
Phase 8 (Agents) — bloqué par Phase 6
    ↓
Phase 9 (Tests) — CONTINU dès Phase 1
Phase 10 (CI/CD) — pipeline minimal dès Phase 1, complet ici
    ↓
Phase 11 (Landing) — quand MVP agent est stable
```

---

## 🔄 WORKFLOW QUOTIDIEN

```bash
# Début de session (chaque agent dans son window tmux)
swarm-log daily
swarm-log feature <slug-en-cours>

# Pendant la journée — logger les décisions importantes
swarm-log feature <slug>       # Appende au work log

# Fin de session — voir le statut global
swarm-log status               # Génère .swarm/status.md

# Depuis le host — standup de toute l'équipe
swarm daily
```

---

## 📦 DÉPENDANCES PRINCIPALES

```json
{
  "dependencies": {
    "next": "^15",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0",
    "drizzle-orm": "^0.38",
    "drizzle-kit": "^0.30",
    "@casl/ability": "^6",
    "@casl/react": "^4",
    "stripe": "^17",
    "inngest": "^3",
    "ai": "^4",
    "@anthropic-ai/sdk": "^0.35",
    "otplib": "^12",
    "qrcode": "^1",
    "resend": "^4",
    "react-email": "^3",
    "zod": "^3",
    "tailwindcss": "^4",
    "@radix-ui/react-*": "latest",
    "date-fns": "^4"
  },
  "devDependencies": {
    "vitest": "^3",
    "@playwright/test": "^1",
    "turbo": "^2"
  }
}
```

---

*Généré le 27/02/2026 — Cédric SaaS Agentique v1 — Swarm-ready*
