# Customer Portal — Factures

## Ce que fait ce module

Expose les factures aux clients authentifiés du portail (`/account`) :
- `GET /api/account/invoices/[id]/file` — stream binaire PDF scopé au client connecté.

La route applique des gardes séquentiels stricts : session → existence → statut (non-draft) → ownership → pdfKey présente → stream. Un brouillon ou une facture appartenant à un autre client retourne un `404` identique — non-divulgation volontaire (indiscernabilité stricte côté customer, anti-IDOR).

> Les boutons UI du portail client (lien vers cette route) sont dans la prochaine itération (hors scope de cette chain).

## Comment l'utiliser

### Route stream PDF

```
GET /api/account/invoices/{id}/file
Authorization: session customer (requireCustomer)
```

Réponse succès (`200`) :

| Header | Valeur |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `inline; filename="facture-{invoice.number}.pdf"` |
| `Content-Length` | taille en octets |
| `Cache-Control` | `no-store` |

Réponses d'erreur :

| Cas | Status | Body |
|---|---|---|
| Non authentifié | redirect (NEXT_REDIRECT) | — |
| Facture inexistante | `404` | `Not Found` |
| Facture en statut draft | `404` | `Not Found` |
| Facture appartenant à un autre client (anti-IDOR) | `404` | `Not Found` |
| `pdfKey` absent (PDF non encore généré) | `404` | `Not Found` |
| Fichier absent dans R2 | `404` | `Not Found` |
| Erreur R2 générique | `500` | `Internal Server Error` |

> Tous les cas d'erreur non-5xx retournent un body `Not Found` identique — aucune fuite d'information sur l'existence ou l'appartenance d'une facture.

## Architecture interne

### Gardes séquentiels (ordre strict)

```
requireCustomer()                           → scope.user + scope.client
getInvoiceById(id)                          → null si UUID invalide ou inexistant → 404
invoice.status === "draft"                  → brouillon non exposé → 404
invoice.clientId !== scope.client.id        → cross-client (anti-IDOR) → 404
invoice.pdfKey == null                      → PDF non généré → 404
// stream :
streamPdfFromR2(invoice.pdfKey)             → stream binaire → 200
```

Le `clientId` est exclusivement tiré de la session (via `requireCustomer`) — jamais de l'URL.

### Principe stream-only côté client

La route ne génère pas le PDF à la demande (`generateAndStoreInvoicePdf` n'est pas importé). Les factures émises ont leur `pdfKey` renseigné à l'émission (route admin). Si le `pdfKey` est absent, l'admin régénère via sa route `/api/invoices/[id]/file` — le client ne déclenche pas de génération.

### Séparation admin / customer

| Route | Guard | Scope |
|---|---|---|
| `GET /api/invoices/[id]/file` | `requireAdmin` | toutes les factures |
| `GET /api/account/invoices/[id]/file` | `requireCustomer` | stream PDF, ownership validé |

Les deux routes partagent `streamPdfFromR2` et `getInvoiceById` sans logique de rôle conditionnelle dans une route partagée.

### Dépendances

- `apps/web/lib/auth.ts` — `requireCustomer()` → `{ user, client }`
- `packages/services/src/invoice.service.ts` — `getInvoiceById(id)` (valide l'UUID, retourne null si invalide ou inexistant)
- `apps/web/lib/storage/r2.ts` — `streamPdfFromR2(key)`, `R2NotFoundError`

## Liens vers tests

- `apps/web/app/api/account/invoices/[id]/file/__tests__/route.test.ts` — 8 cas unitaires (AC1–AC9) : stream 200 avec headers corrects, not-found, draft, ownership, pdfKey null, R2NotFoundError, erreur R2 générique, NEXT_REDIRECT propagé
