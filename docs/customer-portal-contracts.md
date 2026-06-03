# Customer Portal — Contrats de maintenance

## Ce que fait ce module

Expose les contrats de maintenance aux clients authentifiés du portail (`/account/contracts/`) :
- Liste read-only des contrats **visibles** du client connecté.
- Détail read-only avec montant facturé théorique calculé côté client.

Statuts visibles côté customer : `active` + `past_due` (les contrats `canceled` sont masqués).

Le tri est pédagogique : `status ASC` (active avant past_due) puis `startedAt DESC` (le plus récent en premier dans chaque groupe).

## Comment l'utiliser

### Page liste — `/account/contracts`

Route Server Component (`apps/web/app/(customer)/account/contracts/page.tsx`).

- Accessible depuis le menu latéral "Mes contrats" (icône FileSignature).
- Affiche un tableau read-only : **Prestation | Statut | Mode facturation | Prix mensuel | Depuis le**.
- Prix affiché HT (`monthlyPriceEurCents / 100`, suffixe " / mois HT") — le modèle DB ne porte pas `vatRateBps` (franchise TVA, HT = TTC visuellement).
- Empty state : card `data-testid="contracts-empty"` "Aucun contrat actif".
- Tri délégué au service : `status ASC` puis `startedAt DESC`.

Labels statuts FR et billingMode FR centralisés dans `_lib/labels.ts` (voir § Architecture).

| Valeur DB  | Libellé affiché       | Badge variant  |
|------------|-----------------------|----------------|
| `active`   | Actif                 | `success`      |
| `past_due` | Paiement en attente   | `destructive`  |

| Valeur DB        | Libellé affiché      |
|------------------|----------------------|
| `stripe_auto`    | Stripe (auto)        |
| `manual_invoice` | Facturation manuelle |

Le nom de prestation est un lien (`<Link href="/account/contracts/[id]">`) vers la page détail.

### Page détail — `/account/contracts/[id]`

Route Server Component (`apps/web/app/(customer)/account/contracts/[id]/page.tsx`).

Gardes séquentiels :
1. `requireCustomer()` — vérifie la session customer.
2. `getContractByIdForClient(id, clientId)` — retourne `null` si UUID invalide, cross-client ou inexistant.
3. `!CUSTOMER_VISIBLE_CONTRACT_STATUSES.includes(contract.status)` — defense-in-depth : `notFound()` si le contrat est `canceled` (indiscernabilité préservée).

Affichage :
- `<h2 data-testid="contract-detail-title">` — nom de la prestation.
- Badge statut `data-testid="contract-detail-status"` — variant via `STATUS_VARIANT`.
- Grille `dl/dt/dd` : Mode de facturation · Prix mensuel HT · Démarré le · Montant facturé théorique (`data-testid="contract-billed-amount"`).
- `<Link href="/account/contracts" data-testid="contract-back">` — retour liste.

> **404 générique** : le `not-found.tsx` de niveau `account/` (R4.5c2) couvre ce chemin — pas de not-found.tsx dédié au sous-dossier `contracts/`.

> **Stripe currentPeriodStart/End** : non affiché (Stripe non câblé en seed). Reporté à un ticket futur.

### Navigation (CustomerShell + CustomerSidebar)

`CustomerSidebar.tsx` — entrée ajoutée en position 4 (après "Mes rapports", avant "Mon profil") :
```typescript
{ href: "/account/contracts", label: "Mes contrats", icon: FileSignature }
```

`CustomerShell.tsx` — titre de page résolu par segment URL :
```typescript
PAGE_TITLES = { ..., contracts: "Mes contrats" }
```

### Services

```typescript
import { listContractsForCustomerPortal } from '@saas/services/maintenance-contract.service'
import { getContractByIdForClient } from '@saas/services/maintenance-contract.service'
import { computeContractBilledAmount } from '@saas/services/maintenance-contract.shared'
```

**Liste (server-side) :**
```typescript
const contracts = await listContractsForCustomerPortal(clientId)
// Retourne MaintenanceContract[] filtrés status IN ('active', 'past_due'), scopés au clientId
```

**Détail (server-side, guard UUID + cross-client) :**
```typescript
const contract = await getContractByIdForClient(id, clientId)
// Retourne MaintenanceContract | null
// null si id invalide (non-UUID) — sans query DB
// null si id appartient à un autre client (isolation cross-client)
```

**Montant facturé (client-side compatible, arithmétique pure) :**
```typescript
const { monthsBilled, billedAmountEurCents } = computeContractBilledAmount(contract, new Date())
// monthsBilled = months_elapsed(startedAt → min(canceledAt ?? now, now))
// billedAmountEurCents = monthlyPriceEurCents × monthsBilled
// past_due traité comme active (pas de borne sur currentPeriodEnd)
```

## Architecture interne

### Labels centralisés — `_lib/labels.ts`

`apps/web/app/(customer)/account/contracts/_lib/labels.ts` exporte trois constantes typées :

```typescript
export const STATUS_LABELS: Record<CustomerVisibleContractStatus, string>
export const STATUS_VARIANT: Record<CustomerVisibleContractStatus, BadgeVariant>
export const BILLING_MODE_LABELS: Record<MaintenanceBillingMode, string>
```

Colocalisées avec les pages qui les consomment (liste + détail). Module UI — intentionnellement hors `@saas/services` (logique métier pure, pas de labels FR).

### Isolation cross-client

`getContractByIdForClient` applique un double guard :

1. **UUID guard** (`UUID_RE.test(id)`) en tête — retourne `null` immédiatement si invalide, sans exécuter de query. Pas de throw.
2. **WHERE croisé** `id = ? AND clientId = ?` avec `limit(1)` — garantit qu'un contrat d'un autre client retourne `null` (non-divulgation, même comportement que 404).

### Séparation admin / customer

Les fonctions admin existantes (`listContractsByClient`, `getContractById`) **ne sont pas modifiées** et ne portent pas de scope `clientId` strict sur le getById. Les fonctions customer (`listContractsForCustomerPortal`, `getContractByIdForClient`) sont dédiées au portail et découplées.

### Helper partagé `maintenance-contract.shared.ts`

`computeContractBilledAmount` est dans un module séparé (`@saas/services/maintenance-contract.shared`) :
- Zéro dépendance Drizzle/DB — consommable par un Client Component Next.js.
- Exporte aussi `CUSTOMER_VISIBLE_CONTRACT_STATUSES` (`['active', 'past_due']`) pour les guards UI.

### Constante de filtrage

```typescript
export const CUSTOMER_VISIBLE_CONTRACT_STATUSES = ['active', 'past_due'] as const
```

Re-exportée depuis `maintenance-contract.service` pour les couches amont (Server Actions, pages).

## Liens vers tests

```
packages/services/src/__tests__/maintenance-contract.service.test.ts
apps/web/app/(customer)/account/contracts/__tests__/page.test.tsx
apps/web/tests/e2e/customer-contracts.spec.ts
```

`maintenance-contract.service.test.ts` (8 cas) :
- `listContractsForCustomerPortal` : filtrage statuts, isolation clientId, tri `status ASC / startedAt DESC`
- `getContractByIdForClient` : UUID invalide (pas de query), cross-client null, cas nominal
- `computeContractBilledAmount` : calcul mois, past_due sans borne, contrat annulé

`page.test.tsx` (11 cas) :
- Liste : colonnes, empty state, badges statut, labels billingMode, prix HT, lien `contract-link`
- Détail : rendu complet des champs, `notFound()` sur contrat `canceled`, `notFound()` sur contrat `null`
- Shell/Sidebar : entrée nav "Mes contrats", titre page

`customer-contracts.spec.ts` (7 tests e2e Playwright — storageStates acme/globex) :
- T1 — Liste + détail nominal Acme : navigation link prestation → page détail complète (titre, statut, montant `/\d+,\d{2} € HT/`)
- T2 — Empty state Globex : `data-testid="contracts-empty"` visible ("Aucun contrat actif")
- T3 — 404 UUID inexistant (Acme + URL random UUID non présent en DB)
- T4 — 404 non-UUID (Acme + URL `not-a-uuid`)
- T5 — 404 cross-client (Acme tente URL UUID d'un contrat Bob)
- T6 — 404 canceled defense-in-depth (Globex tente URL UUID de son propre contrat `canceled`)
- T7 — Sidebar 6 items dont "Mes contrats" (vérification runtime du menu)

Helper : `resolveContractIdByClientAndStatus(clientSlug, status)` dans `tests/e2e/helpers/resolve-seed-ids.ts` — résout l'UUID DB d'un contrat seed par `clients.slug` + `contract.status`.
