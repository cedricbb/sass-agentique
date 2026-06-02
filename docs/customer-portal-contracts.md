# Customer Portal — Contrats de maintenance

## Ce que fait ce module

Expose les contrats de maintenance aux clients authentifiés du portail (`/account/contracts/`) :
- Liste read-only des contrats **visibles** du client connecté.
- Détail read-only avec montant facturé théorique calculé côté client.

Statuts visibles côté customer : `active` + `past_due` (les contrats `canceled` sont masqués).

Le tri est pédagogique : `status ASC` (active avant past_due) puis `startedAt DESC` (le plus récent en premier dans chaque groupe).

## Comment l'utiliser

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
```

Couvre (8 cas) :
- `listContractsForCustomerPortal` : filtrage statuts, isolation clientId, tri `status ASC / startedAt DESC`
- `getContractByIdForClient` : UUID invalide (pas de query), cross-client null, cas nominal
- `computeContractBilledAmount` : calcul mois, past_due sans borne, contrat annulé
