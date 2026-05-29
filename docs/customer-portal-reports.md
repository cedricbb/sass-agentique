# Customer Portal — Rapports

## Ce que fait ce module

Expose les rapports de livraison aux clients authentifiés du portail (`/account`).
La route stream renvoie le fichier PDF binaire depuis Cloudflare R2 avec quatre gardes
séquentiels garantissant la confidentialité.

## Comment l'utiliser

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

### Gardes séquentiels (ordre strict)

```
requireCustomer()           → scope.user + scope.client
getReportById(id)           → null si UUID invalide ou inexistant → 404
report.issuedAt != null     → rapport émis → sinon 404
report.clientId === scope.client.id  → ownership → sinon 404
streamPdfFromR2(report.filePath)     → stream binaire → 200
```

Le `clientId` est exclusivement tiré de la session (via `requireCustomer`) — jamais de l'URL.

### Séparation admin / customer

| Route | Guard | Scope |
|---|---|---|
| `GET /api/reports/[id]/file` | `requireAdmin` | tous les rapports |
| `GET /api/account/reports/[id]/file` | `requireCustomer` | rapports du client connecté, émis uniquement |

Les deux routes partagent `streamPdfFromR2` et `reportService.getReportById` sans logique de rôle conditionnelle dans une route partagée (décision figée `docs/roadmap-r4.md §3.2`).

### Dépendances

- `apps/web/lib/auth.ts` — `requireCustomer()` → `{ user, client }`
- `packages/services/src/report.service.ts` — `getReportById(id)` avec guard UUID (R4.5a)
- `apps/web/lib/storage/r2.ts` — `streamPdfFromR2(key)`, `R2NotFoundError`

## Liens vers tests

- `apps/web/app/api/account/reports/[id]/file/__tests__/route.test.ts` — 8 cas (AC1–AC8)
- `apps/web/app/api/reports/[id]/file/__tests__/route.test.ts` — route admin (modèle de référence)
