# Roadmap R3 — SaaS Agentique (Atelier Freelance Single-Admin)

> **Date** : 2026-05-18
> **Origine** : refonte du plan `saas-swarm-plan.md` (multi-tenant / workflow swarm) après pivot R3 (single-admin / workflow YAML Orchid).
> **Statut repo** : R3 en cours — ST1 → ST7 ACCEPTED & merged, CI verte. Prochain ticket : **ST8 (Payments)**.
> **Métriques actuelles** : 708 tests unit + 28 e2e Playwright, 100% verts.

---

## 0. Contexte — Ce qui a pivoté depuis le plan initial

Le plan original `saas-swarm-plan.md` (27/02/2026) visait un **SaaS multi-tenant agentique** avec un workflow d'équipe d'agents (PM, Architect, Dev-Back, Dev-Front, QA, UI/UX) opérant via `swarm`. Il a été remplacé par une cible et un workflow différents.

### Cible produit — du multi-tenant SaaS à l'atelier freelance single-admin

| Dimension | Plan initial (multi-tenant SaaS) | Cible R3 (atelier freelance) |
|---|---|---|
| Modèle | SaaS multi-locataire, N tenants, N users par tenant | Single-admin (Cédric), N clients externes |
| Auth | Supabase Auth + NextAuth v5 | Auth custom homemade (déjà R1, validée R2) |
| Tenancy | `tenant_id` partout + RLS Supabase | Pas de tenant, role `admin` vs `customer` |
| Permissions | CASL avec rôles OWNER/ADMIN/MEMBER/VIEWER × tenants | CASL allégé : `admin` / `customer` (R3 a simplifié encore) |
| Storage DB | Postgres Supabase hosted | Postgres + Drizzle (provider TBD prod) |
| Entités métier | Contacts, tasks, calendar, emails (CRM générique) | **Clients, Prestations, Projects, Quotes, Invoices, Payments, Reports, Contracts** (atelier freelance) |
| Agents IA | Phase 8 — agents Calendar + Mail + chat | Hors scope R3 — refusé par le pivot |
| Stripe | Plans Free/Pro/Business SaaS | Stripe Subscriptions sur Contracts maintenance uniquement |
| Landing | Marketing SaaS générique | Portfolio freelance + pricing prestations |

### Workflow de développement — du swarm au YAML Orchid

| Dimension | Plan initial (swarm) | Workflow actuel (Orchid + YAML) |
|---|---|---|
| Orchestration | `swarm team dev-team --model claude`, tmux windows par rôle | YAML déposé dans `.orchid/backlog/`, exécuté par Orchid headless |
| Traçabilité | `.swarm/features/<slug>/<role>.md` (work logs par agent) | `.orchid/backlog/` → `.orchid/done/` après QA ACCEPTED |
| Cycle | Daily standup human-driven, 6 rôles en parallèle | Sous-ticket S/M par YAML, sequence linéaire avec phase_1 / phase_2 / phase_3 |
| QA | Agent QA review PR | Bloc `phase_3_qa` dans le YAML + `human_validation_checklist` Cédric |
| Output | Branches feature, commits attribués par agent | Branche unique, commits attribués `developer` (jamais `tech_lead`) |
| Extension fichier | N/A | `.yml` obligatoire (pas `.yaml`) sinon Orchid ne déplace pas |
| CI | GitHub Actions identique | GitHub Actions valide à chaque push (le YAML peut SKIP `pnpm build` local) |

### Découpage R3 — du `Phase 0 → 11` au `ST1 → ST11`

Le plan initial avait 11 phases (0 fondations → 11 landing). R3 a redécoupé en **11 sous-tâches** (ST1 → ST11), toutes ciblées routes admin Next.js + entités métier atelier freelance. Phases 0-6 du plan initial sont absorbées dans R1+R2 (déjà livrées). Phase 7 (admin) + Phase 7.5 (CRM) + Phase 8 (agents) sont remplacées par ST1-ST11.

### Patterns process consolidés (R2.3 → R3)

14 patterns formalisés dans `yaml-patterns-r2_3.md` (à respecter pour chaque YAML R3+). Voir section 8 pour le détail.

---

## 1. Architecture cible R3

### Stack technique (figée post-R2)

| Couche | Technologie |
|---|---|
| Monorepo | pnpm workspaces + turbo v2 (`tasks`) |
| Frontend | Next.js 15 App Router |
| Backend | Server Actions (pas d'API Routes sauf streaming) |
| DB | PostgreSQL + Drizzle ORM (queries dans services uniquement) |
| Auth | Custom homemade (cookie `session-token`, validation 2 étages middleware Edge + layout Node) |
| Permissions | CASL v6 simplifié `admin` / `customer` |
| Forms | react-hook-form + `@hookform/resolvers/zod` + shadcn `Form` |
| Validation | Zod schemas colocalisés dans `packages/services/src/<entity>.schemas.ts` |
| URL state | nuqs (`useQueryStates`) |
| Tables | `@tanstack/react-table` v8 + shadcn DataTable |
| UI | shadcn/ui (`new-york`, baseColor `neutral`, thème amber préservé) |
| Tests | Vitest 3 (unit + actions) + Playwright (e2e) |
| Email | Resend + React Email |
| Paiement | Stripe v17 (lazy singleton — Pattern 5) |
| TOTP | otplib + qrcode |

### Structure monorepo

```
packages/
  config/         (constantes partagées, 20 tests)
  db/             (Drizzle schema + queries + seed, 55 tests)
  permissions/    (CASL admin/customer, 10 tests)
  services/       (14 services métier R2.2, 272 tests post-ST7)
  ui/             (shadcn/ui components)
  workflows/      (orchestration future)
  agents/         (vide, métadonnées)
  scripts/        (utilitaires)

apps/
  web/            (Next.js 15, 436 tests + 28 e2e post-ST7)
```

### Schéma DB R3 (entités métier)

Tables R3 livrées en R2 (DDL + service + tests), exposées en UI par ST3-ST10 :

```
# — Auth & admin (R1) —
users            id, email, hashed_password, totp_secret, role (admin/customer), banned_at
sessions         standard cookie session
agent_tasks      legacy R1, conservé

# — CRM atelier freelance (R2) —
clients              id, name, email, phone, company, address, notes, created_at
prestations          id, label, description, unit_price_ht, vat_rate, created_at
projects             id, client_id, name, status (active/paused/done/cancelled), notes, created_at
quotes               id, client_id, project_id?, number (Q-YYYY-NNN), status, notes, created_at
quote_items          id, quote_id, prestation_id?, label, qty, unit_price_ht, vat_rate
invoices             id, client_id, quote_id?, number (INV-YYYY-NNN), status, due_at, notes, created_at
invoice_items        id, invoice_id, label, qty, unit_price_ht, vat_rate (pas de prestation_id — snapshot)
payments             id, invoice_id, amount, method (stripe_card/bank_transfer/other), paid_at, stripe_ref?
reports              id, project_id, file_path, summary, created_at
maintenance_contracts id, client_id, plan (json), mode (manual/stripe_auto), status, started_at, stripe_subscription_id?
```

### Arborescence cible `/admin/<entity>` × 8 entités

```
apps/web/app/(admin)/admin/
├── page.tsx                          ← Dashboard KPIs (ST11)
├── agent-tasks/                      ← Conservé R1
├── profile/                          ← Conservé
├── users/                            ← Conservé
├── clients/                          ← ST3 ✅
├── prestations/                      ← ST4 ✅
├── projects/                         ← ST5 ✅
├── quotes/                           ← ST6 ✅
├── invoices/                         ← ST7 ✅
├── payments/                         ← ST8 (prochain ticket)
├── reports/                          ← ST9
└── contracts/                        ← ST10
```

Chaque entité produit :

| Fichier | Rôle |
|---|---|
| `app/(admin)/admin/<entity>/page.tsx` | Server Component liste paginée |
| `app/(admin)/admin/<entity>/[id]/page.tsx` | Server Component détail/édition |
| `app/(admin)/admin/<entity>/new/page.tsx` | Server Component création |
| `app/actions/<entity>.ts` | Server Actions CRUD |
| `apps/web/lib/schemas/<entity>.schemas.ts` | Schemas Zod (validation client+serveur) |
| `apps/web/app/(admin)/admin/<entity>/_components/` | Client Components |

### Authentification 2 étages — VALIDÉE

| Étage | Fichier | Runtime | Rôle |
|---|---|---|---|
| 1 — middleware edge | `apps/web/middleware.ts` | Edge | Vérifie cookie `session-token`, redirect `/login` si absent |
| 2 — layout admin Node | `apps/web/app/(admin)/layout.tsx` | Node | `validateSession` + check `role === "admin"`, redirect si non-admin |

Le middleware Edge ne peut pas accéder à la DB (pas de `postgres`/`bcrypt` en Edge). La validation complète est déléguée au Server Component layout.

---

## 2. Plan R3 — ST1 → ST11

### Vue d'ensemble

| ST | Nom | Effort | Statut | Tests ajoutés |
|---|---|---|---|---|
| ST1 | Helpers transversaux + purge legacy | M | ✅ ACCEPTED | ~20 unit helpers |
| ST2 | DataTable + shadcn install | S | ✅ ACCEPTED | ~15 unit |
| ST3 | CRUD Clients | M | ✅ ACCEPTED | ~40 (unit + actions + e2e) |
| ST4 | CRUD Prestations | M | ✅ ACCEPTED | ~40 |
| ST5 | CRUD Projects | M | ✅ ACCEPTED | ~40 |
| ST6 | CRUD Quotes | L | ✅ ACCEPTED (sous-tickets ST6.1-6.5) | ~45 |
| ST7 | CRUD Invoices | L | ✅ ACCEPTED (sous-tickets ST7.1-7.5) | ~45 |
| **ST8** | **CRUD Payments** | **M** | **🔜 PROCHAIN TICKET** | **~30 prévu** |
| ST9 | CRUD Reports | M | TODO | ~35 |
| ST10 | CRUD Contracts maintenance | M | TODO | ~40 |
| ST11 | Dashboard KPIs | S | TODO | ~20 |

### Graphe de dépendances

```
ST1 ──→ ST2 ──→ ST3 ──→ ST5 ──→ ST9
                  │       └──→ ST6 ──→ ST7 ──→ ST8 ✅ jusqu'ici
                  ├──→ ST4
                  └──→ ST10

ST3-ST10 ──→ ST11
```

---

## 3. Récap livraisons ST1 → ST7

### ST1 — Helpers transversaux + purge legacy ✅

- Création `lib/auth.ts` (`requireAdmin`, `getSession`), `lib/action-result.ts` (type `ActionResult<T,E>` + `handleActionError`), `lib/format.ts` (`formatCurrency`, `formatDate`, `formatPercent`)
- Purge `TenantContext`, `Sidebar legacy`, `accept-invitation`
- Refactor `useAbility.ts` + `Can.tsx` pour lire le rôle depuis session (plus de tenant context)
- Mapping des 11 erreurs métier R2.2 dans `ERROR_MAP` (cf. section 4)

### ST2 — DataTable + shadcn install ✅

- Composants installés : `form`, `textarea`, `checkbox`, `popover`, `calendar`, `command`, `tabs`, `skeleton`, `toast`, `sonner`, `progress`, `switch`
- Création `components/ui/data-table/` (data-table, pagination nuqs, column-header, toolbar, faceted-filter)

### ST3 — CRUD Clients ✅

- Routes `/admin/clients`, `/admin/clients/new`, `/admin/clients/[id]`
- Server Actions : create, update, delete, list
- Schemas Zod : create, update, list params
- Composants : ClientsTable, ClientForm

### ST4 — CRUD Prestations ✅

- Routes `/admin/prestations` + new + [id]
- TVA + prix HT, calcul TTC inline
- Mode édition lock-free (catalogue)

### ST5 — CRUD Projects ✅

- Routes `/admin/projects` + new + [id]
- 5 statuts (active/paused/done/cancelled + 1 transition)
- Transitions service (`InvalidProjectTransitionError` → code `PROJECT_INVALID_TRANSITION`)
- Décision UI : assert sur valeurs littérales seed connues (pas regex spéculative) — leçon ST5

### ST6 — CRUD Quotes ✅ (5 sous-tickets ST6.1-6.5)

- Routes `/admin/quotes` + new + [id]
- Numérotation : `DRAFT-<id>` provisoire en draft, `Q-YYYY-NNN` au passage `sent`
- 5 statuts (draft / sent / accepted / rejected / expired) + transitions
- Lock items côté UI dès `sent` (badge "Verrouillé")
- Extraction `quote.shared.ts` (Pattern 11 — Server/Client split) — premier cas
- Calcul TTC partagé via `computeQuoteTtc` (zero dep DB)
- Compteurs : services 269, web ~330, e2e 22

### ST7 — CRUD Invoices ✅ (5 sous-tickets ST7.1-7.5)

- Routes `/admin/invoices` + new + [id]
- Numérotation `INV-YYYY-NNN` **à la création** (≠ quotes — convention facture comptable engageante dès émission)
- 5 statuts (draft / sent / partial / paid / cancelled) + 7 transitions actives + 2 terminaux
- Lock dur header post-`sent` : seuls `notes` et `dueAt` éditables
- Lock items côté UI dès `sent` (service ne porte AUCUNE garde de statut sur items — décision R2.2)
- `invoice_items` n'a **pas** de `prestationId` (snapshot comptable)
- Cross quote→invoice : QuoteToInvoiceButton sur quotes accepted sans invoice
- InvoiceBalanceCard : Total TTC / Payé / Reste dû + badge 4 états (anticipe ST8)
- Compteurs : services 272, web 436, e2e 28

### Décisions produit cumulées ST1-ST7

1. **Single-admin** : pas de tenant_id nulle part. Le role `admin` (Cédric) voit tout, le role `customer` voit son propre périmètre via account portal (post-MVP).
2. **Numérotation** : `Q-YYYY-NNN` au passage `sent` (ST6), `INV-YYYY-NNN` à la création (ST7). Pattern asymétrique justifié comptablement.
3. **Lock items côté UI uniquement** dès statut "émis" (sent quote, sent invoice). Service permissif côté items (R2.2 décision).
4. **Snapshot comptable** : `quote_items` peut référencer `prestation_id` (raccourci), `invoice_items` n'a pas de `prestation_id` (figé).
5. **Pas de cron transitions** : toutes les transitions sont manuelles via UI (expired devis n'est pas auto).
6. **Filtrage cross-entité** côté Server Component (filter JS), pas de service dédié (ex: "quotes accepted sans invoice" en ST7.5 sans `findInvoiceByQuoteId`).

---

## 4. Mapping erreurs métier R2.2 → codes ActionResult

| Service | Classe erreur | Code | Status |
|---|---|---|---|
| quote | `InvalidQuoteTransitionError` | `QUOTE_INVALID_TRANSITION` | 409 |
| quote→invoice | `InvalidQuoteForInvoicingError` | `QUOTE_NOT_INVOICABLE` | 409 |
| quote→invoice | `QuoteAlreadyInvoicedError` | `QUOTE_ALREADY_INVOICED` | 409 |
| invoice | `InvalidInvoiceTransitionError` | `INVOICE_INVALID_TRANSITION` | 409 |
| **payment** | **`PaymentDeletionOnPaidInvoiceError`** | **`PAYMENT_LOCKED_BY_INVOICE`** | **409** |
| report | `InvalidFilePathError` | `REPORT_INVALID_PATH` | 400 |
| maintenance-contract | `ClientAlreadyHasActiveContractError` | `CONTRACT_DUPLICATE` | 409 |
| maintenance-contract | `InvalidContractTransitionError` | `CONTRACT_INVALID_TRANSITION` | 409 |
| maintenance-contract | `ContractNotInStripeAutoModeError` | `CONTRACT_NOT_STRIPE_AUTO` | 400 |
| stripe | `StripeServiceError` | `STRIPE_ERROR` | 502 |
| project | `InvalidProjectTransitionError` | `PROJECT_INVALID_TRANSITION` | 409 |

Toutes mappées dans `ERROR_MAP` du fichier `lib/action-result.ts` depuis ST1.

---

## 5. Pattern Server Actions

```typescript
type ActionResult<T = void, E = string> =
  | { success: true; data: T }
  | { success: false; error: E; code?: string; status?: number };

async function withAdmin<T>(
  fn: (adminUser: User) => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const user = await requireAdmin();
    const data = await fn(user);
    return { success: true, data };
  } catch (error) {
    return handleActionError(error);
  }
}
```

Toute Server Action métier utilise `withAdmin(...)`. Validation Zod en début de fonction, mutation service, `revalidatePath`, retour data.

---

## 6. ST8 — CRUD Payments (PROCHAIN TICKET)

### Spec produit visée

| Aspect | Décision visée (à confirmer ST8.1) |
|---|---|
| Périmètre | Enregistrement manuel de paiements par admin (Stripe webhook auto = R5, hors scope ST8) |
| Vue liste | Page dédiée `/admin/payments` (liste globale) **+** liste contextuelle dans page détail invoice — *à arbitrer* |
| Vue détail | Page `/admin/payments/[id]` minimaliste (lecture, lien retour invoice) |
| Création | Depuis page détail invoice : bouton "Enregistrer un paiement" → dialog ou page `/admin/invoices/[id]/payments/new` — *à arbitrer* |
| Méthodes | `stripe_card`, `bank_transfer`, `other` (3 valeurs déjà R2.2) |
| Ouverture création | Invoice statuts `sent` + `partial` (pas `draft`, pas `paid` par défaut — over-payment refusé MVP) |
| Side-effect | `createPayment` → `recomputeInvoiceBalance` → bascule auto invoice `paid` si fully paid, `partial` si partiel |
| Suppression | Confirm dialog. Bloqué si invoice `paid` → `PaymentDeletionOnPaidInvoiceError` → message UI clair "Annulez le paiement de la facture avant de supprimer ce règlement" |
| Édition | Hors scope MVP. Un paiement enregistré n'est pas éditable (corriger = supprimer + recréer) — *à arbitrer* |
| Stripe ref | Champ `stripe_ref` optionnel à la création manuelle (paiement encaissé externe puis tracé) |

### Sous-tickets ST8 proposés (modèle ST7 — 5 tickets S/M)

| Sous-ticket | Effort | Périmètre | Pré-requis |
|---|---|---|---|
| **ST8.1** | S | Server actions payments (createPayment, deletePayment, listPayments, getPaymentById) + 3 schemas zod + dette R2.2 `listPayments orderBy(desc(paidAt))` à vérifier en diag + extraction `payment.shared.ts` si besoin (Pattern 11) | ST7 mergé |
| **ST8.2** | S | Route `/admin/payments` (Server + PaymentsTable Client) + seed 2-3 paiements supplémentaires (au-delà du seed ST7.2 partiel sur INV-2026-002) + constantes `SEED_PAYMENT_*` | ST8.1 |
| **ST8.3** | M | Création paiement depuis page détail invoice : `RecordPaymentDialog` (ou route dédiée — arbitrage ST8.1) + `PaymentForm` + intégration sur `/admin/invoices/[id]` (bouton conditionnel sur statut) + assertion side-effect (sent → partial → paid auto) | ST8.1, ST8.2 |
| **ST8.4** | S | Liste payments en page détail invoice (`InvoicePaymentsList` sous `InvoiceBalanceCard`) + suppression avec confirm + gestion erreur `PaymentDeletionOnPaidInvoiceError` côté UI | ST8.3 |
| **ST8.5** | M | E2E Playwright `payments.spec.ts` : 5-6 tests (création partiel, création fully → bascule auto paid, suppression payment, blocage delete sur paid, liste globale, lien retour invoice) + `human_validation_checklist` Cédric | ST8.1-8.4 |

### Acceptance criteria épic ST8 (haut niveau)

1. Admin enregistre un paiement depuis page invoice détail (sent ou partial), invoice bascule auto `partial` ou `paid` selon montants.
2. Admin voit la liste des payments d'une invoice dans la page détail (sous BalanceCard).
3. Admin peut supprimer un payment sur invoice non-paid. Sur invoice paid, erreur claire affichée.
4. Page `/admin/payments` liste tous les paiements (tri desc paidAt), pagination nuqs, recherche libre (montant ou client).
5. Compteurs cibles : services 272 → ~275 (+3 si extraction shared), web 436 → ~466, e2e 28 → ~34.

### Questions à arbitrer en kickoff ST8.1

- **Page liste globale** `/admin/payments` ou uniquement contextuelle (page détail invoice) ? *Reco* : globale + contextuelle, alignement avec quotes/invoices.
- **Bouton "Enregistrer un paiement"** : ouvert sur quels statuts ? *Reco* : `sent` + `partial` uniquement. `draft` non. `paid` non (over-payment refusé MVP).
- **UI création** : dialog modal (rapide) ou page dédiée `/admin/invoices/[id]/payments/new` (cohérence avec quote items) ? *Reco* : dialog (1-2 champs : montant, méthode, date, ref optionnelle — pas besoin d'une page).
- **Affichage liste payments dans page invoice** : table, list, timeline ? *Reco* : list simple (rang, méthode, date, montant, action delete), pas de timeline (over-engineering MVP).
- **Édition payment** : autorisée ? *Reco* : NON. Supprimer + recréer. Évite bugs sur recomputeInvoiceBalance.
- **Stripe ref champ libre** ou validation regex `ch_*` / `pi_*` ? *Reco* : champ libre optionnel, pas de validation regex (paiements externes hors Stripe possibles via ce champ).

---

## 7. Reste à faire R3 (ST9 → ST11)

### ST9 — CRUD Reports (M)

- Routes `/admin/reports`, `/admin/reports/new`, `/admin/reports/[id]`
- Lien à project_id (`InvalidFilePathError` → `REPORT_INVALID_PATH`)
- Upload PDF — **spike technique en début ST9** (S3/R2 presigned URL par défaut)
- Estimation ~35 tests

### ST10 — CRUD Contracts maintenance (M)

- Routes `/admin/contracts`
- Mode `manual` ou `stripe_auto` (subscription Stripe)
- 3 erreurs métier (`CONTRACT_DUPLICATE`, `CONTRACT_INVALID_TRANSITION`, `CONTRACT_NOT_STRIPE_AUTO`)
- Stripe lazy singleton à respecter (Pattern 5 — NE PAS réintroduire eager init)
- Estimation ~40 tests

### ST11 — Dashboard KPIs (S)

- Refactor `/admin/page.tsx` avec KPIs métier (MRR contracts, CA mois, factures impayées, devis en attente)
- StatCard métier + graphiques (recharts probablement, déjà disponible)
- Estimation ~20 tests

---

## 8. Patterns process consolidés (14)

Tous formalisés dans `yaml-patterns-r2_3.md`. À appliquer pour chaque YAML ST8+.

### Patterns techniques (1-10) — héritage R2

| # | Nom | Résumé |
|---|---|---|
| 1 | Server Components par défaut | Client Components uniquement pour interactivité |
| 2 | Server Actions | Pas d'API Routes sauf streaming |
| 3 | Validation Zod | Schemas partagés client/serveur |
| 4 | Revalidation | `revalidatePath` après mutation |
| 5 | Stripe lazy singleton | `getStripeClient()` au runtime, jamais à l'import |
| 6 | Loading states | `loading.tsx` + Suspense |
| 7 | Auth dans layout | Pas dans chaque page |
| 8 | Drizzle dans services | Jamais dans composants |
| 9 | Types inférés | `InferSelectModel` depuis Drizzle |
| 10 | Pagination server-side | Jamais client-side sur listes métier |

### Patterns process (11-14) — émergés R3

| # | Nom | Origine | Résumé |
|---|---|---|---|
| 11 | Server/Client split via `*.shared.ts` | ST6 → ST7.1 | Extraction fn pure cross-utilisée dans sous-module `*.shared.ts` + subpath export `package.json`. Zero dep DB. Grep négatif obligatoire en QA. |
| 12 | Evidence runtime obligatoire | ST6.5 → ST7.5 | Grep ciblé sur valeurs littérales seed + log brut `pnpm test:e2e` copié dans rapport QA. Container QA bloqué → autorisation logs CI. |
| 13 | Séparation tech_lead / developer | ST7.2 → ST7.3 | Phase_1 = spec uniquement (pas de commit). Phase_2 ré-écrit. Bloc `role_separation:` en tête YAML. NON-NÉGOCIABLE. |
| 14 | `human_validation_checklist` | ST7.4 → ST7.5 | AC visuels extraits en section séparée, exécutée par Cédric après QA agent ACCEPTED. |

### Mémoires e2e à appliquer d'office (du userMemories)

| # | Mémoire | À appliquer dès ST8.1 |
|---|---|---|
| 1 | Extension `.yml` (pas `.yaml`) | ✅ tous les YAMLs |
| 2 | CI GitHub fait le build → SKIP `pnpm build` local | ✅ tous les YAMLs |
| 3 | Pattern Radix Select e2e : `getByRole("option", {name})` après ouverture trigger | ✅ tout YAML e2e avec Select |
| 4 | Pattern row-scoped : `getByRole("row", {name})` jamais `.first()` global | ✅ tout YAML e2e avec table |
| 5 | Check-list pré-YAML auth : seed step en CI + storageState + loginAsAdmin URL | ✅ tout YAML e2e avec auth |
| 6 | Server Actions navigation : `revalidatePath` seul → pas de `waitForURL` ; `redirect`/`router.push` → `Promise.all([waitForURL, click])` | ✅ tout YAML e2e |
| 7 | Pollution DB locale : `.filter({hasText: STATUS}).first()` ou reset+seed avant runs répétés | ✅ tout YAML e2e |
| 8 | QA process : log brut `pnpm test:e2e` exigé dans rapport QA, jamais analyse statique seule | ✅ tous les YAMLs e2e |

---

## 9. Dette R2.2 résiduelle

| Dette | Statut | À traiter quand |
|---|---|---|
| `listClients` sans orderBy | Ouverte | Quand un YAML l'utilise dans contexte e2e/pagination |
| `listAllProjects` sans orderBy | Ouverte | Idem |
| `listPrestations` sans orderBy | Ouverte | Idem |
| `listQuoteItems` sans orderBy | Ouverte | Idem |
| `listInvoiceItems` sans orderBy | Ouverte | Idem |
| `listPayments` orderBy ? | À diag ST8.1 | ST8.1 |
| `listQuotes` orderBy | ✅ Fixé ST6 |
| `listInvoices` orderBy | ✅ Fixé ST7.1 |

Règle : ne pas faire de YAML dédié à cette dette, la rembourser au cas par cas dans le YAML qui consomme.

---

## 10. Risques R3 résiduels

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| 1 | Edge Runtime + Drizzle | Crash bloquant | Maintenir séparation 2 étages middleware/layout. Linter rule à terme. |
| 2 | Stripe lazy singleton | Crash silencieux ST10 | Pattern 5 strict. Garde anti-régression en place. |
| 3 | Upload PDF ST9 | Scope creep | Spike technique début ST9. S3/R2 presigned URL par défaut. |
| 4 | Volume tests CI | CI > 5 min | Déjà ~736 tests, encore OK. Surveiller, parallélisation Vitest si besoin. |
| 5 | Container QA Playwright | Trou validation visuelle | Pattern 12 + Pattern 14. À terme installer libglib + playwright deps dans container Orchid. |

---

## 11. Briefing pour démarrer ST8 dans un nouveau chat

### Message d'ouverture suggéré

```
On démarre ST8 (Payments). Contexte :
- ST7 (Invoices) complet, 5 sous-tickets ACCEPTED, CI verte, 708 unit + 28 e2e.
- roadmap-r3.md à jour avec toutes décisions ST1-ST7 + spec ST8 visée.
- Patterns 11/12/13/14 formalisés dans yaml-patterns-r2_3.md.
- codebase.md à jour post-ST7.5.

Démarre ST8.1 avec un YAML qui :
1. Diag service `payment.service.ts` (signatures, orderBy listPayments, side-effects)
2. Crée les 4 server actions + 3 schemas zod
3. Applique Patterns 11 (shared si besoin), 12 (evidence), 13 (role_separation), 14 (human_validation_checklist)
4. Mémoires e2e #4 (Radix Select), #5 (row-scoped), #6 (CI seed step) intégrées d'office

Pose-moi les questions d'arbitrage de la section 6 (UI dialog vs page, statuts ouverts, etc.) avant de proposer le YAML.
```

### Fichiers à uploader dans le nouveau chat

- `codebase.md` (snapshot post-ST7.5)
- `roadmap-r3.md` (ce fichier)
- `pivot-r3-architecture.md` (référence architecture)
- `yaml-patterns-r2_3.md` (patterns process)
- `handover-st7-complete-ready-for-st8.md` (handover détaillé)

---

## Annexe — Statut du plan initial `saas-swarm-plan.md`

Le plan initial est **archivé**. Les éléments suivants y sont définitivement abandonnés :

- ❌ Workflow swarm tmux (remplacé par YAML Orchid)
- ❌ Multi-tenant (remplacé par single-admin)
- ❌ Supabase Auth (remplacé par auth custom homemade)
- ❌ CRM générique contacts/tasks/calendar/emails (remplacé par atelier freelance clients/projects/quotes/invoices)
- ❌ Phase 8 agents IA Calendar+Mail (hors scope MVP)
- ❌ Plans Stripe SaaS Free/Pro/Business (remplacé par Stripe Subscription sur Contracts maintenance ST10)

Conservé sans changement (présent dans repo R1/R2) :
- ✅ Stack Next.js 15 + TypeScript strict + Drizzle + Postgres
- ✅ shadcn/ui + Tailwind v4 + Radix primitives
- ✅ CASL v6 (simplifié)
- ✅ Stripe v17 (uniquement pour Contracts ST10)
- ✅ otplib + qrcode pour 2FA/TOTP
- ✅ Vitest 3 + Playwright
- ✅ Resend + React Email
- ✅ Turborepo + pnpm workspaces

---

*Document rédigé le 18/05/2026 — Cédric SaaS Agentique R3 — Prêt ST8*
