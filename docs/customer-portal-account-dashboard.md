# Customer Portal — Dashboard (/account)

## Ce que fait ce module

Page d'accueil du portail client (`/account`). Affiche 3 cards stats cliquables (Devis / Factures / Rapports) avec des compteurs actionables fetch en SSR via `Promise.all`.

Chaque card :
- Affiche un compteur sémantique selon le nombre d'items "actionnables" du client connecté.
- Renvoie vers la liste complète correspondante (`/account/quotes`, `/account/invoices`, `/account/reports`).
- Adapte son texte à l'état vide (pas "0 devis" mais "Aucun devis en attente").

Stats exposées :
- **Devis** : nombre de devis avec `status = "sent"` (en attente d'acceptation)
- **Factures** : nombre de factures avec `status = "sent"` (à payer)
- **Rapports** : nombre de rapports avec `issuedAt IS NOT NULL` (émis)

## Comment l'utiliser

La page est un Server Component async — aucune interaction client nécessaire.

```ts
// apps/web/app/(customer)/account/page.tsx
const [quotesCount, invoicesCount, reportsCount] = await Promise.all([
  countPendingQuotesForClient(client.id),
  countUnpaidInvoicesForClient(client.id),
  countIssuedReportsForClient(client.id),
]);
```

Textes générés selon le compte :

| Count | Devis | Factures | Rapports |
|-------|-------|----------|---------|
| 0 | "Aucun devis en attente" | "Aucune facture à payer" | "Aucun rapport disponible" |
| 1 | "1 devis en attente d'acceptation" | "1 facture à payer" | "1 rapport disponible" |
| N | "N devis en attente d'acceptation" | "N factures à payer" | "N rapports disponibles" |

## Architecture interne

Le composant `AccountPage` (Server Component) :
1. Appelle `requireCustomer()` pour récupérer le `clientId` de session.
2. Lance 3 requêtes COUNT en parallèle via `Promise.all`.
3. Génère les textes via des fonctions pures (`quotesStatText`, `invoicesStatText`, `reportsStatText`).
4. Rend 3 `<Link>` + `<Card>` shadcn en grid 3 colonnes responsive.

Fonctions service (dans `@saas/services`) :

| Fonction | Fichier | Filtre DB |
|----------|---------|-----------|
| `countPendingQuotesForClient(clientId)` | `quote.service.ts` | `status = 'sent'` |
| `countUnpaidInvoicesForClient(clientId)` | `invoice.service.ts` | `status = 'sent'` |
| `countIssuedReportsForClient(clientId)` | `report.service.ts` | `issuedAt IS NOT NULL` |

Toutes retournent `Promise<number>` avec fallback `?? 0` sur row manquant.

## Liens vers tests

- `apps/web/app/(customer)/account/__tests__/page.test.tsx` — 3 tests : stats avec counts, textes état vide, hrefs des cards
- `packages/services/src/__tests__/quote.service.test.ts` — `count_pending_quotes_returns_sent_only`, `count_pending_quotes_returns_zero_when_none_sent`
- `packages/services/src/__tests__/invoice.service.test.ts` — `count_unpaid_invoices_returns_sent_only`, `count_unpaid_invoices_returns_zero_when_none_sent`
- `packages/services/src/__tests__/report.service.test.ts` — `count_issued_reports_returns_issued_only`, `count_issued_reports_returns_zero_when_none_issued`
