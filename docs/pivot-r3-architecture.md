# Pivot R3 — Architecture Routes Admin Next.js

> Document de cadrage technique pour la phase R3 du pivot sass-agentique → atelier freelance.
> Référence : [docs/PIVOT.md](PIVOT.md) (résumé exécutif).
> Référence : [docs/pivot-document.md](pivot-document.md) (analyse complète du pivot).
> Date : 2026-05-13

---

## 1. État des lieux apps/web post-R2

### Arborescence actuelle

```
apps/web/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       ├── page.tsx              ← Dashboard (à refactor R3)
│   │       ├── agent-tasks/          ← Legacy R1
│   │       ├── profile/              ← Profil admin
│   │       ├── tenants/              ← Legacy multi-tenant (à purger)
│   │       └── users/                ← Gestion users
│   ├── (app)/
│   │   └── settings/
│   │       └── billing/              ← Billing Stripe (hors scope R3)
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   ├── verify-2fa/
│   │   ├── verify-email/
│   │   └── accept-invitation/        ← Legacy multi-tenant (à purger)
│   ├── (customer)/
│   │   └── account/                  ← Portail client (post-MVP)
│   │       ├── orders/
│   │       ├── profile/
│   │       └── security/
│   ├── (marketing)/
│   │   ├── page.tsx                  ← Landing
│   │   └── pricing/                  ← Pricing
│   ├── actions/
│   │   ├── admin.ts
│   │   ├── auth.ts
│   │   ├── profile.ts
│   │   └── totp.ts
│   └── api/
│       └── admin/
│           └── agent-tasks/
├── components/
│   ├── admin/                        ← 6 composants
│   ├── auth/                         ← 10 composants
│   ├── billing/                      ← 12 composants
│   ├── dashboard/                    ← 6 composants
│   ├── layout/                       ← 6 composants
│   ├── permissions/                  ← Can.tsx
│   ├── profile/                      ← 2 composants
│   └── ui/                           ← 17 composants shadcn
├── contexts/
│   └── TenantContext.tsx             ← Legacy (à purger)
├── hooks/
│   └── useAbility.ts                ← Dépend TenantContext (à refactor)
├── lib/
│   └── utils.ts
└── config/
    └── admin-profile.ts
```

### Matrice GARDER / REFACTOR / PURGER

| Élément | Catégorie | Verdict | Raison |
|---|---|---|---|
| `(admin)/admin/page.tsx` | Dashboard | REFACTOR | KPIs métier R3 (ST11) |
| `(admin)/admin/agent-tasks/` | Legacy R1 | GARDER | Fonctionnel, pas de changement |
| `(admin)/admin/profile/` | Profil | GARDER | Fonctionnel |
| `(admin)/admin/tenants/` | Multi-tenant | PURGER | Incompatible single-admin |
| `(admin)/admin/users/` | Users | GARDER | Gestion clients/admin |
| `(app)/settings/billing/` | Billing | GARDER | Hors scope R3 |
| `(auth)/login/` | Auth | GARDER | Flow auth conservé |
| `(auth)/register/` | Auth | GARDER | Flow auth conservé |
| `(auth)/forgot-password/` | Auth | GARDER | Flow auth conservé |
| `(auth)/reset-password/` | Auth | GARDER | Flow auth conservé |
| `(auth)/verify-2fa/` | Auth | GARDER | TOTP conservé |
| `(auth)/verify-email/` | Auth | GARDER | Vérification email conservée |
| `(auth)/accept-invitation/` | Multi-tenant | PURGER | Invitations tenant supprimées |
| `(customer)/account/*` | Portail client | GARDER | Post-MVP, pas touché |
| `(marketing)/` | Landing | GARDER | Portfolio freelance |
| `(marketing)/pricing/` | Pricing | GARDER | Catalogue prestations |
| `components/admin/AdminSidebar` | Navigation | REFACTOR | Ajouter liens entités R3 |
| `components/admin/AdminPagination` | UI | GARDER | Réutilisable |
| `components/admin/AdminSearch` | UI | GARDER | Réutilisable |
| `components/admin/AgentTaskLogsDrawer` | Legacy | GARDER | Fonctionnel |
| `components/admin/AgentTaskStatusFilter` | Legacy | GARDER | Fonctionnel |
| `components/admin/UserActions` | Admin | GARDER | Actions ban/unban/totp |
| `components/dashboard/*` | Dashboard | REFACTOR | KPIs métier R3 (ST11) |
| `components/layout/Sidebar` | Legacy | PURGER | Multi-tenant sidebar |
| `components/layout/ThemeProvider` | UI | GARDER | Thème amber préservé |
| `components/layout/AppShell` | Layout | GARDER | Shell applicatif |
| `components/layout/Header` | Layout | GARDER | Header réutilisable |
| `components/layout/CustomerShell` | Client | GARDER | Portail client |
| `components/layout/CustomerSidebar` | Client | GARDER | Portail client |
| `components/permissions/Can.tsx` | RBAC | REFACTOR | Dépend TenantContext legacy |
| `contexts/TenantContext.tsx` | Multi-tenant | PURGER | Legacy multi-tenant |
| `hooks/useAbility.ts` | RBAC | REFACTOR | Dépend TenantContext |

### Composants shadcn installés (17)

alert-dialog, alert, avatar, badge, button, card, dialog, dropdown-menu, input, label, otp-input, scroll-area, select, separator, sheet, table, tooltip.

Configuration : style `new-york`, RSC `true`, baseColor `neutral`, CSS variables `true`, icon library `lucide`.

### Thème

Thème primary amber préservé pour R3 : `oklch(0.7686 0.1647 70.0804)` en light et dark (amber-500 equivalent). Aucun changement de thème prévu.

### Authentification 2 étages — VALIDÉ, À GARDER

| Étage | Fichier | Runtime | Rôle |
|---|---|---|---|
| 1 — middleware edge | `apps/web/middleware.ts` | Edge | Vérifie présence cookie `session-token`, redirect `/login` si absent |
| 2 — layout admin Node | `apps/web/app/(admin)/layout.tsx` | Node | `validateSession` + check `role === "admin"`, redirect si non-admin |

Ce pattern en 2 étages est conforme au pivot (D3). Le middleware Edge ne peut pas accéder à la DB (pas de postgres/bcrypt en Edge Runtime). La validation complète est déléguée au Server Component layout.

---

## 2. Architecture cible R3

### Arborescence cible `/admin/<entity>` × 8 entités

```
apps/web/app/(admin)/admin/
├── page.tsx                          ← Dashboard KPIs (ST11)
├── agent-tasks/                      ← Conservé
├── profile/                          ← Conservé
├── users/                            ← Conservé
├── clients/                          ← NOUVEAU (ST3)
│   ├── page.tsx                      ← Liste clients
│   ├── [clientId]/
│   │   └── page.tsx                  ← Détail client
│   └── new/
│       └── page.tsx                  ← Formulaire création
├── prestations/                      ← NOUVEAU (ST4)
│   ├── page.tsx
│   ├── [prestationId]/
│   │   └── page.tsx
│   └── new/
│       └── page.tsx
├── projects/                         ← NOUVEAU (ST5)
│   ├── page.tsx
│   ├── [projectId]/
│   │   └── page.tsx
│   └── new/
│       └── page.tsx
├── quotes/                           ← NOUVEAU (ST6)
│   ├── page.tsx
│   ├── [quoteId]/
│   │   └── page.tsx
│   └── new/
│       └── page.tsx
├── invoices/                         ← NOUVEAU (ST7)
│   ├── page.tsx
│   ├── [invoiceId]/
│   │   └── page.tsx
│   └── new/
│       └── page.tsx
├── payments/                         ← NOUVEAU (ST8)
│   ├── page.tsx
│   └── [paymentId]/
│       └── page.tsx
├── reports/                          ← NOUVEAU (ST9)
│   ├── page.tsx
│   ├── [reportId]/
│   │   └── page.tsx
│   └── new/
│       └── page.tsx
└── contracts/                        ← NOUVEAU (ST10)
    ├── page.tsx
    ├── [contractId]/
    │   └── page.tsx
    └── new/
        └── page.tsx
```

### Pattern fichiers par entité

Chaque entité (ex: `clients`) produit :

| Fichier | Rôle |
|---|---|
| `app/(admin)/admin/<entity>/page.tsx` | Server Component — liste paginée |
| `app/(admin)/admin/<entity>/[id]/page.tsx` | Server Component — détail/édition |
| `app/(admin)/admin/<entity>/new/page.tsx` | Server Component — création |
| `app/actions/<entity>.ts` | Server Actions (CRUD) |
| `components/admin/<entity>/` | Client Components (formulaires, tables) |
| `packages/services/src/<entity>.schemas.ts` | Schemas Zod (validation partagée) |

### Helpers transversaux ST1

| Fichier | Rôle |
|---|---|
| `lib/auth.ts` | `requireAdmin()`, `getSession()` — extraction du pattern layout.tsx + actions |
| `lib/action-result.ts` | Type `ActionResult<T,E>`, helper `handleActionError()` |
| `lib/format.ts` | Formateurs : `formatCurrency()`, `formatDate()`, `formatPercent()` |

---

## 3. Pattern Server Actions

### Type central `ActionResult<T,E>`

```typescript
type ActionResult<T = void, E = string> =
  | { success: true; data: T }
  | { success: false; error: E; code?: string; status?: number };
```

Toute Server Action retourne un `ActionResult`. Les composants client consomment le résultat via pattern matching sur `success`.

### Helper `withAdmin`

```typescript
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

Chaque Server Action métier utilise `withAdmin` :

```typescript
export async function createClientAction(
  input: CreateClientInput
): Promise<ActionResult<Client>> {
  return withAdmin(async () => {
    const validated = createClientSchema.parse(input);
    const client = await createClient(validated);
    revalidatePath("/admin/clients");
    return client;
  });
}
```

### Mapping des 11 erreurs métier R2.2

| Service | Classe erreur | Code ActionResult | Status HTTP |
|---|---|---|---|
| quote | `InvalidQuoteTransitionError` | `QUOTE_INVALID_TRANSITION` | 409 |
| quote → invoice | `InvalidQuoteForInvoicingError` | `QUOTE_NOT_INVOICABLE` | 409 |
| quote → invoice | `QuoteAlreadyInvoicedError` | `QUOTE_ALREADY_INVOICED` | 409 |
| invoice | `InvalidInvoiceTransitionError` | `INVOICE_INVALID_TRANSITION` | 409 |
| payment | `PaymentDeletionOnPaidInvoiceError` | `PAYMENT_LOCKED_BY_INVOICE` | 409 |
| report | `InvalidFilePathError` | `REPORT_INVALID_PATH` | 400 |
| maintenance-contract | `ClientAlreadyHasActiveContractError` | `CONTRACT_DUPLICATE` | 409 |
| maintenance-contract | `InvalidContractTransitionError` | `CONTRACT_INVALID_TRANSITION` | 409 |
| maintenance-contract | `ContractNotInStripeAutoModeError` | `CONTRACT_NOT_STRIPE_AUTO` | 400 |
| stripe | `StripeServiceError` | `STRIPE_ERROR` | 502 |
| project | `InvalidProjectTransitionError` | `PROJECT_INVALID_TRANSITION` | 409 |

### Helper `handleActionError`

```typescript
const ERROR_MAP: Record<string, { code: string; status: number }> = {
  InvalidQuoteTransitionError: { code: "QUOTE_INVALID_TRANSITION", status: 409 },
  InvalidQuoteForInvoicingError: { code: "QUOTE_NOT_INVOICABLE", status: 409 },
  QuoteAlreadyInvoicedError: { code: "QUOTE_ALREADY_INVOICED", status: 409 },
  InvalidInvoiceTransitionError: { code: "INVOICE_INVALID_TRANSITION", status: 409 },
  PaymentDeletionOnPaidInvoiceError: { code: "PAYMENT_LOCKED_BY_INVOICE", status: 409 },
  InvalidFilePathError: { code: "REPORT_INVALID_PATH", status: 400 },
  ClientAlreadyHasActiveContractError: { code: "CONTRACT_DUPLICATE", status: 409 },
  InvalidContractTransitionError: { code: "CONTRACT_INVALID_TRANSITION", status: 409 },
  ContractNotInStripeAutoModeError: { code: "CONTRACT_NOT_STRIPE_AUTO", status: 400 },
  StripeServiceError: { code: "STRIPE_ERROR", status: 502 },
  InvalidProjectTransitionError: { code: "PROJECT_INVALID_TRANSITION", status: 409 },
};

function handleActionError(error: unknown): ActionResult<never> {
  if (error instanceof Error) {
    const mapping = ERROR_MAP[error.constructor.name];
    if (mapping) {
      return { success: false, error: error.message, ...mapping };
    }
  }
  return { success: false, error: "Une erreur est survenue." };
}
```

Le `ActionResult` remplace le pattern actuel `{ error?: string }` utilisé dans `app/actions/admin.ts`, qui ne distingue pas les types d'erreur et ne fournit pas de code machine-readable.

---

## 4. Pattern Forms

### Stack technique

| Librairie | Rôle |
|---|---|
| `react-hook-form` | Gestion état formulaire, validation client |
| `@hookform/resolvers/zod` | Bridge zod → react-hook-form |
| `zod` | Schemas validation partagés client/serveur |
| shadcn `Form` | Composants `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` |

### Schemas colocalisés

Les schemas Zod sont définis dans `packages/services/src/<entity>.schemas.ts` et importés côté client ET serveur :

```typescript
// packages/services/src/client.schemas.ts
import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
```

### Pattern composant formulaire

```typescript
// components/admin/clients/ClientForm.tsx
"use client";

export function ClientForm({ onSubmit }: ClientFormProps) {
  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { name: "", email: "" },
  });

  async function handleSubmit(values: CreateClientInput) {
    const result = await onSubmit(values);
    if (!result.success) {
      form.setError("root", { message: result.error });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)}>
        {/* FormField pour chaque champ */}
      </form>
    </Form>
  );
}
```

---

## 5. Pattern URL state (nuqs)

### Librairie

`nuqs` (ex `next-usequerystate`) — synchronisation bidirectionnelle URL ↔ state React, compatible RSC.

### Pattern pagination / tri / recherche server-side

```typescript
// hooks/useTableParams.ts
import { useQueryStates, parseAsInteger, parseAsString } from "nuqs";

export function useTableParams() {
  return useQueryStates({
    page: parseAsInteger.withDefault(1),
    perPage: parseAsInteger.withDefault(20),
    sort: parseAsString.withDefault("createdAt"),
    order: parseAsString.withDefault("desc"),
    search: parseAsString.withDefault(""),
  });
}
```

Les Server Components lisent les searchParams directement :

```typescript
// app/(admin)/admin/clients/page.tsx
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; perPage?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const perPage = Number(params.perPage) || 20;
  const clients = await listClients({ page, perPage, search: params.search });
  // ...
}
```

---

## 6. Pattern Tables

### Stack technique

| Librairie | Rôle |
|---|---|
| `@tanstack/react-table` v8 | Core table headless (tri, pagination, filtres) |
| shadcn `DataTable` | Composants UI : `DataTable`, `DataTablePagination`, `DataTableColumnHeader` |

### Structure `components/ui/data-table/`

```
components/ui/data-table/
├── data-table.tsx                ← Composant principal
├── data-table-pagination.tsx     ← Pagination avec nuqs
├── data-table-column-header.tsx  ← Header triable
├── data-table-toolbar.tsx        ← Barre recherche + filtres
└── data-table-faceted-filter.tsx ← Filtres à facettes (status, etc.)
```

### Pattern définition colonnes

```typescript
// components/admin/clients/columns.tsx
export const clientColumns: ColumnDef<Client>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nom" />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Créé le" />,
    cell: ({ row }) => formatDate(row.getValue("createdAt")),
  },
  {
    id: "actions",
    cell: ({ row }) => <ClientRowActions client={row.original} />,
  },
];
```

Chaque entité R3 définit ses colonnes dans `components/admin/<entity>/columns.tsx`.

---

## 7. Tests R3

### Pyramide de tests

| Niveau | Scope | Framework | Répertoire |
|---|---|---|---|
| Unit | Services, schemas, utils | Vitest | `packages/services/src/__tests__/`, `core/tests/` |
| Actions | Server Actions (intégration) | Vitest | `apps/web/app/actions/__tests__/` |
| E2E | Flows critiques | Playwright | `apps/web/e2e/` |

### Compteur cible fin R3

| Type | Existants R2 | Ajoutés R3 | Total cible |
|---|---|---|---|
| Unit services | ~120 | ~160 (8 entités × 20) | ~280 |
| Unit schemas | 0 | ~40 (8 entités × 5) | ~40 |
| Actions | ~15 | ~80 (8 entités × 10) | ~95 |
| E2E | ~10 | ~50 (8 flows CRUD) | ~60 |
| **Total** | **~145** | **~330** | **~475** |

### Conventions

- Chaque Server Action a un test correspondant dans `app/actions/__tests__/<entity>.test.ts`
- Chaque schema Zod a des tests de validation (cas valides + invalides)
- Tests E2E couvrent : CRUD complet, transitions de statut, erreurs métier affichées
- Chaque élément UI interactif porte un `data-testid` kebab-case stable

---

## 8. Composants shadcn à installer

### Composants requis R3

| Composant | Usage |
|---|---|
| `form` | Formulaires react-hook-form |
| `textarea` | Champs notes/description |
| `checkbox` | Sélection multiple tables |
| `popover` | Date picker, combobox |
| `calendar` | Sélection dates (devis, factures) |
| `command` | Combobox recherche (clients, projets) |
| `tabs` | Navigation détail entité |
| `skeleton` | Loading states |
| `toast` | Notifications ActionResult |
| `sonner` | Toast provider (alternative shadcn) |
| `progress` | Barre progression (projets) |
| `switch` | Toggle paramètres |

### Commande d'installation

```bash
pnpm dlx shadcn@latest add form textarea checkbox popover calendar command tabs skeleton toast sonner progress switch
```

### Composants déjà installés (17)

alert-dialog, alert, avatar, badge, button, card, dialog, dropdown-menu, input, label, otp-input, scroll-area, select, separator, sheet, table, tooltip.

---

## 9. Plan 11 sous-tâches (ST1 — ST11)

| ST | Nom | Effort | Inputs | Outputs | Tests ajoutés | Dépendances |
|---|---|---|---|---|---|---|
| ST1 | Helpers transversaux + purge legacy | M | Ce document | `lib/auth.ts`, `lib/action-result.ts`, `lib/format.ts`, purge TenantContext/Sidebar legacy | ~20 (unit helpers) | Aucune |
| ST2 | DataTable + shadcn install | S | ST1 | `components/ui/data-table/*`, composants shadcn installés | ~15 (unit DataTable) | ST1 |
| ST3 | CRUD Clients | M | ST1, ST2 | Routes `/admin/clients`, actions, schemas, composants | ~40 (unit + actions + e2e) | ST1, ST2 |
| ST4 | CRUD Prestations | M | ST1, ST2 | Routes `/admin/prestations`, actions, schemas, composants | ~40 | ST1, ST2 |
| ST5 | CRUD Projects | M | ST1, ST2, ST3 | Routes `/admin/projects`, actions, schemas, composants | ~40 | ST3 (relation client) |
| ST6 | CRUD Quotes | L | ST1, ST2, ST3, ST4 | Routes `/admin/quotes`, actions, schemas, transitions statut | ~45 | ST3, ST4 (client + prestation) |
| ST7 | CRUD Invoices | L | ST1, ST2, ST6 | Routes `/admin/invoices`, actions, schemas, génération depuis devis | ~45 | ST6 (quote → invoice) |
| ST8 | CRUD Payments | M | ST1, ST2, ST7 | Routes `/admin/payments`, actions, schemas | ~30 | ST7 (lié factures) |
| ST9 | CRUD Reports | M | ST1, ST2, ST5 | Routes `/admin/reports`, actions, schemas, upload PDF | ~35 | ST5 (lié projets) |
| ST10 | CRUD Contracts maintenance | M | ST1, ST2, ST3 | Routes `/admin/contracts`, actions, schemas, Stripe subscription | ~40 | ST3 (client), Stripe |
| ST11 | Dashboard KPIs | S | ST3-ST10 | Refactor dashboard, StatCard métier, graphiques | ~20 (unit + e2e) | ST3-ST10 |

### Effort légende

- **S** (Small) : 1-2 jours
- **M** (Medium) : 2-4 jours
- **L** (Large) : 4-6 jours

### Graphe de dépendances

```
ST1 ──→ ST2 ──→ ST3 ──→ ST5 ──→ ST9
                  │       └──→ ST6 ──→ ST7 ──→ ST8
                  │                      
                  ├──→ ST4     
                  └──→ ST10
                  
ST3-ST10 ──→ ST11
```

---

## 10. Risques

| # | Risque | Impact | Mitigation |
|---|---|---|---|
| 1 | **Edge Runtime + Drizzle** — Le middleware Edge ne peut pas importer `@saas/db` (dépendances Node.js : `postgres`, `bcrypt`). | Bloquant si import accidentel dans middleware. | Maintenir la séparation 2 étages : middleware edge (cookie only) + layout Node (DB validation). Linter rule `no-restricted-imports` sur le middleware. |
| 2 | **Stripe lazy singleton** — Le service Stripe initialise le client à l'import. Si importé dans un Server Component sans clé API, crash silencieux. | Crash production sur routes contracts/payments. | Lazy initialization : `getStripeClient()` avec vérification `STRIPE_SECRET_KEY` au runtime. Fallback explicite en dev. |
| 3 | **Upload PDF** — La génération/upload de rapports PDF n'a pas de solution validée. `InvalidFilePathError` existe mais le flow complet (génération → stockage → URL signée) est une question ouverte. | Scope creep ST9. | Cadrer le flow upload comme spike technique en début de ST9. S3/R2 presigned URL comme approche par défaut. |
| 4 | **TenantContext legacy** — `useAbility.ts` et `Can.tsx` dépendent de `useTenant()` via `TenantContext`. La purge de TenantContext en ST1 casse ces composants. | Régression RBAC. | ST1 doit d'abord refactorer `useAbility` pour lire le rôle depuis la session (prop drilling ou context allégé), puis purger TenantContext. |
| 5 | **Schemas Zod inexistants** — Aucun `*.schemas.ts` n'existe dans `packages/services/src/`. La validation est actuellement implicite (pas de zod). | Incohérence validation client/serveur. | Création progressive par entité (ST3-ST10). Chaque ST crée le schema avant le formulaire. |
| 6 | **Volume de tests** — Passage de ~145 à ~475 tests. Risque de tests lents bloquant la CI. | CI lente > 5 min. | Parallélisation Vitest, isolation DB par test suite, skip E2E en CI fast (run nightly). |
| 7 | **Migration DB** — Les nouvelles tables (clients, projects, quotes, invoices, payments, reports, maintenance_contracts) nécessitent des migrations Drizzle. | Schema drift entre branches. | Une migration par ST, appliquée avant le code. Pas de migration cross-ST. |

---

## Annexes

### Services R2.2 disponibles (14)

| Service | Fichier | Importable |
|---|---|---|
| admin | `admin.service.ts` | ✅ |
| auth | `auth.service.ts` | ✅ |
| client | `client.service.ts` | ✅ |
| email | `email.service.ts` | ✅ |
| invoice | `invoice.service.ts` | ✅ |
| maintenance-contract | `maintenance-contract.service.ts` | ✅ |
| payment | `payment.service.ts` | ✅ |
| prestation | `prestation.service.ts` | ✅ |
| profile | `profile.service.ts` | ✅ |
| project | `project.service.ts` | ✅ |
| quote | `quote.service.ts` | ✅ |
| report | `report.service.ts` | ✅ |
| stripe | `stripe.service.ts` | ✅ |
| totp | `totp.service.ts` | ✅ |

### Patterns R2 référencés

Les patterns process R2 (1-10) définis dans le cadrage R2 s'appliquent toujours :
- Pattern 1 : Server Components par défaut, Client Components uniquement pour interactivité
- Pattern 2 : Server Actions pour mutations, pas d'API Routes sauf streaming
- Pattern 3 : Validation Zod partagée client/serveur
- Pattern 4 : Revalidation via `revalidatePath` après mutation
- Pattern 5 : Error boundaries par route segment
- Pattern 6 : Loading states via `loading.tsx` + Suspense
- Pattern 7 : Auth check dans layout, pas dans chaque page
- Pattern 8 : Drizzle queries dans services, jamais dans composants
- Pattern 9 : Types inférés depuis Drizzle schema (`InferSelectModel`)
- Pattern 10 : Pagination server-side, jamais client-side sur listes métier

### Glossaire rapide

| Terme | Définition |
|---|---|
| ActionResult | Type discriminé success/error pour retours Server Actions |
| DataTable | Composant table headless basé TanStack Table v8 |
| nuqs | Librairie URL state management pour Next.js |
| ST | Sous-tâche du plan R3 |
| RBAC | Role-Based Access Control (admin/client) |
| Edge Runtime | Runtime léger Next.js middleware (pas de Node.js APIs) |
