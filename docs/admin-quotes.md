# Admin — Devis

## Ce que fait ce module

Gestion des devis côté admin : liste paginée, page détail par devis, et téléchargement PDF des devis émis.

## Comment l'utiliser

### Télécharger un PDF de devis

Le bouton **"Télécharger le PDF"** apparaît uniquement sur les devis dont `issuedAt` est renseigné (devis émis). Les brouillons n'ont pas de bouton — la route retourne 404 pour eux.

**Page détail** (`/admin/quotes/[id]`) : bouton outline dans l'en-tête, à côté du numéro de devis. Le clic déclenche le téléchargement via `<a download>` (même origine → attribut HTML natif, sans redirection).

**Liste** (`/admin/quotes`) : icône `Download` (lucide-react) dans la colonne actions de chaque ligne, à gauche du crayon d'édition, visible uniquement si `issuedAt != null`.

La route servie est : `GET /api/quotes/[id]/file`

Le nom de fichier téléchargé suit le pattern : `devis-{quote.number}.pdf`

## Architecture interne

- `apps/web/app/api/quotes/[id]/file/route.ts` — Route Handler Node.js (runtime `nodejs`) qui :
  1. Vérifie l'accès admin (`requireAdmin()`).
  2. Charge le devis (`getQuoteById`). Absent → 404.
  3. Résout la clé R2 : `pdfKey` présent → stream direct ; `pdfKey null + issuedAt null` → 404 (brouillon) ; `pdfKey null + issuedAt set` → régénération paresseuse via `generateAndStoreQuotePdf`.
  4. Streame le PDF depuis R2 (`streamPdfFromR2`). `R2NotFoundError` → 404 ; autre erreur → 500.
- `apps/web/app/(admin)/admin/quotes/[id]/page.tsx` — Server Component qui charge le devis et rend le bouton conditionnel dans un `flex gap-4` avec le titre `<h1>`.
- `apps/web/app/(admin)/admin/quotes/_components/QuotesTable.tsx` — colonne `actions` : div flex contenant l'icône Download conditionnelle + le lien Pencil existant.

Le pattern commun : `<Button asChild><a href="/api/quotes/{id}/file" download="devis-{number}.pdf">...</a></Button>`. L'attribut `download` force le téléchargement plutôt que l'ouverture en onglet, même si la route répond `Content-Disposition: inline`.

## Liens vers tests

- `apps/web/app/api/quotes/[id]/file/__tests__/route.test.ts` — 8 tests couvrant : stream 200, quote absent, lazy regen, brouillon 404, R2NotFoundError 404, erreur R2 générique 500, redirect non-admin, échec regen.
- `apps/web/app/(admin)/admin/quotes/[id]/__tests__/page.test.tsx` — `shows_download_button_when_issued`, `hides_download_button_when_draft`
- `apps/web/app/(admin)/admin/quotes/_components/__tests__/QuotesTable.test.tsx` — `shows_download_icon_for_issued_quote_row`, `hides_download_icon_for_draft_quote_row`
