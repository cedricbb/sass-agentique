# Admin — Devis

## Ce que fait ce module

Gestion des devis côté admin : liste paginée, page détail par devis, téléchargement PDF des devis émis, et sélection d'un contact destinataire au sein du formulaire de création/édition.

## Comment l'utiliser

### Télécharger un PDF de devis

Le bouton **"Télécharger le PDF"** apparaît uniquement sur les devis dont `issuedAt` est renseigné (devis émis). Les brouillons n'ont pas de bouton — la route retourne 404 pour eux.

**Page détail** (`/admin/quotes/[id]`) : bouton outline dans l'en-tête, à côté du numéro de devis. Le clic déclenche le téléchargement via `<a download>` (même origine → attribut HTML natif, sans redirection).

**Liste** (`/admin/quotes`) : icône `Download` (lucide-react) dans la colonne actions de chaque ligne, à gauche du crayon d'édition, visible uniquement si `issuedAt != null`.

La route servie est : `GET /api/quotes/[id]/file`

Le nom de fichier téléchargé suit le pattern : `devis-{quote.number}.pdf`

### Sélectionner un contact destinataire

Le formulaire de devis expose un Select **"Destinataire (contact)"** (`data-testid="quote-contactId-select"`).

**Création** (`/admin/quotes/new`) :
- Le Select est **masqué** tant qu'aucun client n'est sélectionné.
- Après sélection d'un client, il affiche les contacts de ce client + l'option "Aucun (entreprise seule)".
- Si le client possède un contact principal (`isPrimary = true`), il est **pré-sélectionné automatiquement**.
- Si le client n'a pas de contact principal, le Select reste sur "Aucun (entreprise seule)".
- Changer de client re-pré-sélectionne le contact principal du nouveau client (ou "Aucun" si absent).
- `createQuoteAction` reçoit `contactId` (UUID string) ou `undefined` si "Aucun".

**Édition** (`/admin/quotes/[id]`) :
- Le Select est **toujours visible**, pré-rempli avec `quote.contactId` si existant.
- Options filtrées sur `quote.clientId` (client fixé en édition).
- `updateQuoteAction` reçoit `contactId` (UUID string ou `null`/`undefined`).

La liste des contacts est chargée côté serveur (page parente) via `listClientContactsByOwner` (create) ou `listClientContacts` (edit) et passée en prop `contacts` à `QuoteForm`.

## Architecture interne

### Résolution des noms de clients dans la liste

La page `/admin/quotes` résout les noms des clients via `getClientNamesByIds(ids)` (sans filtre `archivedAt`). Pour les clients archivés, le suffixe `(archivé)` est ajouté dans la map avant d'être passé à `QuotesTable` :

```ts
const clientNames = Object.fromEntries(
  Object.entries(namesMap).map(([id, { name, archived }]) => [
    id,
    archived ? `${name} (archivé)` : name,
  ])
);
```

`listClients()` n'est PAS utilisée ici : elle filtre `archivedAt IS NULL` et est réservée aux Selects de création (on ne crée pas de devis pour un client archivé).

- `packages/services/src/client.service.ts` — `getClientNamesByIds(ids)` : requête `WHERE id IN (...)` sans filtre d'archivage, retourne `Record<string, { name: string; archived: boolean }>`.
- `apps/web/app/(admin)/admin/quotes/page.tsx` — construit la map via `getClientNamesByIds` sur les `clientId` des devis listés.

### Téléchargement PDF et détail

- `apps/web/app/api/quotes/[id]/file/route.ts` — Route Handler Node.js (runtime `nodejs`) qui :
  1. Vérifie l'accès admin (`requireAdmin()`).
  2. Charge le devis (`getQuoteById`). Absent → 404.
  3. Résout la clé R2 : `pdfKey` présent → stream direct ; `pdfKey null + issuedAt null` → 404 (brouillon) ; `pdfKey null + issuedAt set` → régénération paresseuse via `generateAndStoreQuotePdf`.
  4. Streame le PDF depuis R2 (`streamPdfFromR2`). `R2NotFoundError` → 404 ; autre erreur → 500.
- `apps/web/app/(admin)/admin/quotes/[id]/page.tsx` — Server Component qui charge le devis, récupère les contacts du client via `listClientContacts(quote.clientId)` et passe `contacts` à `QuoteForm`. Rend aussi le bouton PDF conditionnel dans un `flex gap-4` avec le titre `<h1>`.
- `apps/web/app/(admin)/admin/quotes/_components/QuotesTable.tsx` — colonne `actions` : div flex contenant l'icône Download conditionnelle + le lien Pencil existant.

Le pattern commun : `<Button asChild><a href="/api/quotes/{id}/file" download="devis-{number}.pdf">...</a></Button>`. L'attribut `download` force le téléchargement plutôt que l'ouverture en onglet, même si la route répond `Content-Disposition: inline`.

`QuoteForm` utilise `react-hook-form`. Le handler `handleClientChange` (mode création uniquement) résout `contacts.find(c => c.clientId === value && c.isPrimary)?.id ?? NONE_CONTACT_VALUE` pour pré-sélectionner le contact principal du client, ou retomber sur « Aucun ». La constante `NONE_CONTACT_VALUE` est partagée avec `InvoiceForm` (pattern symétrique). Le sentinel `"none"` est converti en `undefined` avant l'envoi à l'action. En mode édition, le client est verrouillé (pas de handler) — `initialData.contactId` est préservé tel quel.

## Liens vers tests

- `apps/web/app/api/quotes/[id]/file/__tests__/route.test.ts` — 8 tests couvrant : stream 200, quote absent, lazy regen, brouillon 404, R2NotFoundError 404, erreur R2 générique 500, redirect non-admin, échec regen.
- `apps/web/app/(admin)/admin/quotes/[id]/__tests__/page.test.tsx` — `shows_download_button_when_issued`, `hides_download_button_when_draft`
- `apps/web/app/(admin)/admin/quotes/_components/__tests__/QuotesTable.test.tsx` — `shows_download_icon_for_issued_quote_row`, `hides_download_icon_for_draft_quote_row`
- `apps/web/app/(admin)/admin/quotes/_components/__tests__/QuoteForm.test.tsx` — T6–T12 couvrant : masquage sans client, affichage après client, pré-sélection contact principal au changement client, submit avec/sans contactId, pré-remplissage edit, submit edit.
- `apps/web/tests/e2e/admin-preselect-contact.spec.ts` — tests Playwright partagés avec admin-invoices : pré-sélection devis, fallback sans contact principal, re-pré-sélection au changement de client.
