# Customer Portal — Devis

## Ce que fait ce module

Expose les devis aux clients authentifiés du portail (`/account`) :
- `/account/quotes` — liste read-only des devis **visibles** du client connecté.
- `/account/quotes/[id]` — détail read-only avec métadonnées + lignes.

Chaque niveau applique des gardes séquentiels : session → existence → UUID valide → statut non-draft → ownership.
Un devis brouillon ou appartenant à un autre client retourne un `404` identique — non-divulgation volontaire.

Statuts visibles côté client : `sent`, `accepted`, `declined`, `expired` (constant `CUSTOMER_VISIBLE_QUOTE_STATUSES`).
Les devis `draft` sont exclus de la liste et redirigent vers 404 à l'accès direct.

## Comment l'utiliser

### Pages UI

```
GET /account/quotes
Session: cookie customer (requireCustomer)
```

Affiche un tableau (`data-testid="quotes-table"`) avec colonnes Numéro, Statut, Dates.
Si aucun devis visible : card `data-testid="quotes-empty"`.

```
GET /account/quotes/{id}
Session: cookie customer (requireCustomer)
```

Affiche le bloc `data-testid="quote-detail"` avec :
- Badge statut (`data-testid="quote-detail-status"`)
- Date d'émission (`data-testid="quote-issued-date"`)
- Date d'expiration (`data-testid="quote-expires-date"`)
- Lignes de devis (`data-testid="quote-items-table"`)

Les pages sont read-only : zéro bouton d'action.

## Architecture interne

### Gardes de sécurité (page détail)

Trois gardes séquentiels dans `apps/web/app/(customer)/account/quotes/[id]/page.tsx` :

```
1. requireCustomer()          → session valide + { user, client }
2. getQuoteById(id)           → null si UUID invalide OU inexistant → 404
3. quote.status === "draft"   → notFound() — non-divulgation
4. assertClientOwnership()    → quote.clientId !== client.id → notFound()
```

`getQuoteById` valide le format UUID via `UUID_RE` avant toute requête SQL. Un `id` non-UUID retourne `null` → 404 (jamais 500 Postgres).

### Isolation liste

`listQuotesByClient(clientId)` filtre par `clientId` ET `status IN (CUSTOMER_VISIBLE_QUOTE_STATUSES)` — les brouillons et les devis d'autres clients sont structurellement absents du résultat.

### Routes concernées

| Route | Guard principal | Portée |
|---|---|---|
| `GET /account/quotes` | `requireCustomer` | devis visibles du client connecté |
| `GET /account/quotes/[id]` | `requireCustomer` | devis non-draft, ownership validé |

### Dépendances

- `apps/web/lib/auth.ts` — `requireCustomer()` → `{ user, client }`, `assertClientOwnership()`
- `packages/services/src/quote.service.ts` — `getQuoteById(id)`, `listQuotesByClient(clientId)`, `UUID_RE` (guard uuid)
- `packages/services/src/quote.shared.ts` — `CUSTOMER_VISIBLE_QUOTE_STATUSES`, `CustomerVisibleQuoteStatus`
- `packages/db/src/seed.ts` — devis seed : Q-2026-001 (draft acme), Q-2026-004 (declined acme), Q-2026-005 (expired bob)

## Liens vers tests

- `apps/web/tests/e2e/customer-quotes.spec.ts` — tests e2e Playwright (isolation cross-client, guard draft, liste)
- `packages/services/src/__tests__/quote.service.test.ts` — tests unitaires `getQuoteById` incluant guard UUID (id invalide → null, id inexistant → null, id valide → Quote)
- `apps/web/tests/e2e/helpers/resolve-seed-ids.ts` — `resolveQuoteId(quoteNumber)` pour résolution UUID réel depuis numéro Q-XXXX (seed)
