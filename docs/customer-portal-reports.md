# Customer Portal — Rapports

## Ce que fait ce module

Expose les rapports de livraison aux clients authentifiés du portail (`/account`) :
- `/account/reports` — liste read-only des rapports **émis** du client connecté.
- `/account/reports/[id]` — détail read-only avec métadonnées + lien vers le stream PDF.
- `GET /api/account/reports/[id]/file` — stream binaire PDF scopé au client connecté.

Chaque niveau applique des gardes séquentiels : session → existence → `issuedAt` → ownership.
Un rapport brouillon ou appartenant à un autre client retourne un `404` identique — non-divulgation volontaire.

## Comment l'utiliser

### Pages UI

```
GET /account/reports
Session: cookie customer (requireCustomer)
```

Affiche un tableau (`data-testid="reports-table"`) avec colonnes Titre, Type, Date.
Si aucun rapport émis : card `data-testid="reports-empty"`.

```
GET /account/reports/{id}
Session: cookie customer (requireCustomer)
```

Affiche le bloc `data-testid="report-detail"` avec :
- Titre + badge kind (`data-testid="report-kind-badge"`)
- Date d'émission (`data-testid="report-issued-date"`)
- Résumé si présent (`data-testid="report-summary"`)
- Lien PDF (`data-testid="report-pdf-link"`) vers `/api/account/reports/{id}/file`

Les pages sont read-only : zéro bouton d'action.

### Route stream PDF

```
GET /api/account/reports/{id}/file
Authorization: session customer (requireCustomer)
```

Réponse succès (`200`) :

| Header | Valeur |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `inline; filename="report-{id}.pdf"` |
| `Content-Length` | taille en octets |
| `Cache-Control` | `no-store` |

Réponses d'erreur :

| Cas | Status | Body |
|---|---|---|
| Non authentifié | redirect (NEXT_REDIRECT) | — |
| Report inexistant / non émis / mauvais client | `404` | `Not Found` |
| Fichier absent dans R2 | `404` | `File not found` |
| Erreur R2 générique | `500` | `Internal Server Error` |

> Les cas "inexistant", "non émis" et "mauvais client" retournent un body identique (`Not Found`) — non-divulgation volontaire.

## Architecture interne

### Gardes séquentiels (ordre strict, identique pages + route)

```
requireCustomer()                            → scope.user + scope.client
getReportById(id)                            → null si UUID invalide ou inexistant → 404
report.issuedAt != null                      → rapport émis → sinon 404
assertClientOwnership(report, scope)         → cross-client → 404
// pages UI s'arrêtent ici — route stream continue :
streamPdfFromR2(report.filePath)             → stream binaire → 200
```

Le `clientId` est exclusivement tiré de la session (via `requireCustomer`) — jamais de l'URL.

### Filtrage liste

La page liste appelle `listReportsByClient(client.id, { issuedOnly: true })`.
Les rapports brouillons sont exclus à la source (SQL `WHERE issued_at IS NOT NULL`) — ils n'atteignent pas le rendu.

### Kind labels

| ReportKind | Libellé affiché |
|---|---|
| `delivery` | Livraison |
| `monthly` | Mensuel |
| `audit` | Audit |
| `other` | Autre |

### Séparation admin / customer

| Route / Page | Guard | Scope |
|---|---|---|
| `GET /admin/reports` | `requireAdmin` | tous les rapports |
| `GET /api/reports/[id]/file` | `requireAdmin` | tous les rapports |
| `GET /account/reports` | `requireCustomer` | rapports émis du client connecté |
| `GET /account/reports/[id]` | `requireCustomer` | rapport émis, ownership validé |
| `GET /api/account/reports/[id]/file` | `requireCustomer` | stream PDF, ownership validé |

Les routes admin et customer partagent `streamPdfFromR2` et `reportService.getReportById` sans logique de rôle conditionnelle dans une route partagée.

### Dépendances

- `apps/web/lib/auth.ts` — `requireCustomer()` → `{ user, client }`, `assertClientOwnership()`
- `packages/services/src/report.service.ts` — `getReportById(id)`, `listReportsByClient(clientId, opts)`, `getReportByTitle(title)` (e2e helper)
- `apps/web/lib/storage/r2.ts` — `streamPdfFromR2(key)`, `R2NotFoundError`
- `packages/db/src/seed.ts` — 4 rapports seed (Acme draft, Acme monthly émis, Bob monthly émis, Globex émis)

## Liens vers tests

- `apps/web/tests/e2e/customer-reports.spec.ts` — 7 tests e2e Playwright (isolation cross-client, AC1–AC8), CI GitHub Actions job "E2E Tests"
- `apps/web/app/api/account/reports/[id]/file/__tests__/route.test.ts` — 8 cas unitaires route stream (AC1–AC8)
- `apps/web/tests/e2e/helpers/resolve-seed-ids.ts` — `resolveReportId(reportTitle)` pour résolution UUID seed
