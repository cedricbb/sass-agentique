# Admin — Factures

## Ce que fait ce module

Gestion complète des factures côté admin : liste paginée avec filtres, page détail par facture (édition, cycle de vie, lignes, montants, paiements), et téléchargement PDF des factures émises.

## Comment l'utiliser

### Télécharger un PDF de facture

Le bouton **"Télécharger le PDF"** apparaît uniquement sur les factures dont `issuedAt` est renseigné (factures émises). Les brouillons n'ont pas de bouton — la route retourne 404 pour eux.

**Page détail** (`/admin/invoices/[id]`) : bouton outline dans l'en-tête, à côté du numéro de facture. Le clic déclenche le téléchargement via `<a download>` (même origine → attribut HTML natif, sans redirection).

**Liste** (`/admin/invoices`) : icône `Download` (lucide-react) dans la colonne actions de chaque ligne, à gauche du crayon d'édition, visible uniquement si `issuedAt != null`.

La route servie est : `GET /api/invoices/[id]/file`

Le nom de fichier téléchargé suit le pattern : `facture-{invoice.number}.pdf`

## Architecture interne

- `apps/web/app/(admin)/admin/invoices/[id]/page.tsx` — Server Component qui charge la facture et rend le bouton conditionnel dans un `flex gap-4` avec le titre `<h1>`.
- `apps/web/app/(admin)/admin/invoices/_components/InvoicesTable.tsx` — colonne `actions` : div flex contenant l'icône Download conditionnelle + le lien Pencil existant.

Le pattern commun : `<Button asChild><a href="/api/invoices/{id}/file" download="facture-{number}.pdf">...</a></Button>`. L'attribut `download` force le téléchargement plutôt que l'ouverture en onglet, même si la route répond `Content-Disposition: inline`.

La route `/api/invoices/[id]/file` n'a pas été modifiée.

## Liens vers tests

- `apps/web/app/(admin)/admin/invoices/[id]/__tests__/page.test.tsx` — describe "Download button" : `shows_download_button_when_issued`, `hides_download_button_when_draft`
- `apps/web/app/(admin)/admin/invoices/_components/__tests__/InvoicesTable.test.tsx` — describe "Download icon" : `shows_download_icon_for_issued_invoice_row`, `hides_download_icon_for_draft_invoice_row`
