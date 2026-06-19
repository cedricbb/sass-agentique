# Customer Portal — Devis

## Ce que fait ce module

Expose les devis aux clients authentifiés du portail (`/account`) :
- `/account/quotes` — liste read-only des devis **visibles** du client connecté, avec icône de téléchargement PDF par ligne.
- `/account/quotes/[id]` — détail avec métadonnées + lignes + boutons d'action si statut `sent` + bouton téléchargement PDF.
- `GET /api/account/quotes/[id]/file` — stream PDF sécurisé depuis R2 (ownership-checked, stream-only).

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

Affiche un tableau (`data-testid="quotes-table"`) avec colonnes Numéro, Statut, Dates, et une icône téléchargement par ligne si `pdfKey != null`.
Si aucun devis visible : card `data-testid="quotes-empty"`.

Icône download par ligne (`data-testid="quote-download-{id}"`) : lien `<a download>` vers `/api/account/quotes/{id}/file`. Affiché uniquement si `quote.pdfKey != null` — les devis sans PDF (jamais les drafts côté client) n'ont pas de lien cassé.

```
GET /account/quotes/{id}
Session: cookie customer (requireCustomer)
```

Affiche le bloc `data-testid="quote-detail"` avec :
- Badge statut (`data-testid="quote-detail-status"`)
- Date d'émission (`data-testid="quote-issued-date"`)
- Date d'expiration (`data-testid="quote-expires-date"`)
- Lignes de devis (`data-testid="quote-items-table"`)

Si `quote.status === "sent"` : boutons **Accepter** (`data-testid="quote-accept-trigger"`) et **Refuser** (`data-testid="quote-decline-trigger"`) avec AlertDialog de confirmation.
Si tout autre statut (`accepted`, `declined`, `expired`) : page read-only, aucun bouton d'action.

Bouton **Télécharger mon devis** (`data-testid="quote-download-pdf"`) : affiché si `quote.pdfKey != null`, déclenche un download du PDF depuis `/api/account/quotes/{id}/file`.

### Actions customer (statut `sent` uniquement)

| Action | Server action | Transition DB |
|---|---|---|
| Accepter | `acceptCustomerQuoteAction(quoteId)` | `sent → accepted` + `acceptedAt = now()` |
| Refuser | `declineCustomerQuoteAction(quoteId)` | `sent → declined` |

Les deux actions sont terminales côté customer : impossible de revenir sur `accepted` ou `declined`.

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

### RBAC server actions

`apps/web/app/actions/customer-quotes.ts` — les deux actions utilisent `withCustomer(scope)` :

```
1. withCustomer()                     → session + { user, client } (throw si non-customer)
2. getQuoteById(quoteId)              → null → ActionResult error
3. assertClientOwnershipOrThrow()     → quote.clientId !== scope.client.id → throw FORBIDDEN
4. quote.status !== "sent"            → InvalidQuoteTransitionError (transition invalide)
5. transitionQuoteStatus()            → UPDATE DB + acceptedAt si accepted
6. revalidatePath()                   → liste + détail revalidés
```

Un contact d'un autre client ne peut pas accepter/refuser un devis qui ne lui appartient pas — le guard `assertClientOwnershipOrThrow` lève une erreur `FORBIDDEN` avant toute mutation.

### Composant UI — QuoteCustomerActions

`apps/web/app/(customer)/account/quotes/[id]/QuoteCustomerActions.tsx` :

- Rendu conditionnel : `if (status !== "sent") return null`
- `isPending` géré via `useState` (jamais `useTransition` — leçon R9-6c pour éviter double-toast)
- Deux `AlertDialog` indépendants : un bouton trigger → dialog confirmation → appel action
- `toastResult(result, label)` pour le feedback utilisateur

### Isolation liste

`listQuotesByClient(clientId)` filtre par `clientId` ET `status IN (CUSTOMER_VISIBLE_QUOTE_STATUSES)` — les brouillons et les devis d'autres clients sont structurellement absents du résultat.

### Route PDF — `/api/account/quotes/[id]/file`

`apps/web/app/api/account/quotes/[id]/file/route.ts` (`runtime = "nodejs"`) — gardes stricts dans l'ordre :

```
1. requireCustomer()              → session + { user, client }
2. getQuoteById(id)               → null → 404
3. quote.status === "draft"       → 404 (non-divulgation)
4. quote.clientId !== client.id   → 404 (anti-IDOR)
5. quote.pdfKey == null           → 404 (pas de régénération lazy côté client)
6. streamPdfFromR2(pdfKey)        → Response 200 application/pdf inline
   R2NotFoundError                → 404
   Autre erreur                   → 500 + log
```

Réponse 200 : `Content-Type: application/pdf`, `Content-Disposition: inline; filename="devis-{number}.pdf"`, `Cache-Control: no-store`.

Aucune régénération paresseuse côté client — les devis émis possèdent déjà leur `pdfKey`. Ce garde évite d'importer `generateAndStoreQuotePdf` dans la surface client.

### Routes concernées

| Route | Guard principal | Portée |
|---|---|---|
| `GET /account/quotes` | `requireCustomer` | devis visibles du client connecté |
| `GET /account/quotes/[id]` | `requireCustomer` | devis non-draft, ownership validé |
| `GET /api/account/quotes/[id]/file` | `requireCustomer` + ownership + pdfKey | stream PDF R2 (stream-only) |
| `POST acceptCustomerQuoteAction` | `withCustomer` + ownership | transition sent→accepted |
| `POST declineCustomerQuoteAction` | `withCustomer` + ownership | transition sent→declined |

### Dépendances

- `apps/web/lib/auth.ts` — `requireCustomer()`, `assertClientOwnership()`, `assertClientOwnershipOrThrow()`
- `apps/web/lib/action-result.ts` — `withCustomer()`, `ActionResult<T>`
- `apps/web/lib/r2.ts` — `streamPdfFromR2()`, `R2NotFoundError`
- `packages/services/src/quote.service.ts` — `getQuoteById`, `listQuotesByClient`, `transitionQuoteStatus`, `countPendingQuotesForClient`, `InvalidQuoteTransitionError`, `UUID_RE`
- `packages/services/src/quote.shared.ts` — `CUSTOMER_VISIBLE_QUOTE_STATUSES`, `CustomerVisibleQuoteStatus`
- `packages/db/src/seed.ts` — devis seed : Q-2026-001 (draft acme), Q-2026-004 (declined acme), Q-2026-005 (expired bob)

## Liens vers tests

- `apps/web/app/actions/__tests__/customer-quotes.test.ts` — 7 tests server actions (happy path accept/decline, RBAC cross-client, transition invalide, redirect)
- `apps/web/app/(customer)/account/quotes/[id]/__tests__/QuoteCustomerActions.test.tsx` — 5 tests composant UI (visibilité boutons, masquage hors sent, AlertDialog, isPending)
- `apps/web/app/api/account/quotes/[id]/file/__tests__/route.test.ts` — 8 tests route PDF (404 draft, 404 cross-client, 404 pdfKey null, 200 stream, R2NotFoundError, 500 R2 error, unauthenticated)
- `apps/web/tests/e2e/customer-quotes.spec.ts` — tests e2e Playwright (isolation cross-client, guard draft, liste)
- `packages/services/src/__tests__/quote.service.test.ts` — tests unitaires `getQuoteById` incluant guard UUID, `countPendingQuotesForClient` (sent only + zero)
