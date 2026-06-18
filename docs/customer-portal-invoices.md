# Customer Portal — Factures

## Ce que fait ce module

Expose les factures aux clients authentifiés du portail (`/account`) :
- `GET /api/account/invoices/[id]/file` — stream binaire PDF scopé au client connecté.
- Page détail `/account/invoices/[id]` — bouton "Télécharger ma facture" conditionnel.
- Page liste `/account/invoices` — icône de téléchargement par ligne, conditionnelle.

La route applique des gardes séquentiels stricts : session → existence → statut (non-draft) → ownership → pdfKey présente → stream. Un brouillon ou une facture appartenant à un autre client retourne un `404` identique — non-divulgation volontaire (indiscernabilité stricte côté customer, anti-IDOR).

## Comment l'utiliser

### Boutons de téléchargement (UI portail client)

**Page détail** (`/account/invoices/[id]`) — Server Component :

```tsx
{invoice.pdfKey != null && (
  <Button variant="outline" size="sm" asChild>
    <a
      href={`/api/account/invoices/${invoice.id}/file`}
      download={`facture-${invoice.number}.pdf`}
    >
      <Download className="mr-2 h-4 w-4" /> Télécharger ma facture
    </a>
  </Button>
)}
```

Affiché dans l'en-tête de la page, à côté du numéro et du badge statut. Non rendu si `pdfKey == null` (PDF non encore généré → évite un lien cassé vers une route 404).

**Page liste** (`/account/invoices`) — colonne par ligne :

```tsx
{invoice.pdfKey != null && (
  <Button variant="ghost" size="icon" asChild>
    <a
      href={`/api/account/invoices/${invoice.id}/file`}
      download={`facture-${invoice.number}.pdf`}
    >
      <Download className="h-4 w-4" />
      <span className="sr-only">Télécharger ma facture</span>
    </a>
  </Button>
)}
```

Icône seule avec label `sr-only` pour l'accessibilité. Cellule vide si `pdfKey == null`.

> Les factures en statut `draft` ne sont jamais affichées côté client (`notFound()` dans les deux pages) — la condition `pdfKey != null` couvre uniquement les factures émises sans PDF généré.

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
