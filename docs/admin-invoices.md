# Admin — Factures

## Ce que fait ce module

Gestion complète des factures côté admin : liste paginée avec filtres, page détail par facture (édition, cycle de vie, lignes, montants, paiements), téléchargement PDF des factures émises, et sélection du contact destinataire (« À l'attention de »).

## Comment l'utiliser

### Sélectionner le contact destinataire

Le formulaire de facture expose un Select **"Destinataire (contact)"** permettant de cibler un contact spécifique du client (ex. : « À l'attention de … » dans le PDF à venir).

**Création** (`/admin/invoices/new`) :
- Le Select n'apparaît que lorsqu'un client est choisi.
- Options : « Aucun (entreprise seule) » + les contacts du client sélectionné.
- Aucun contact pré-sélectionné par défaut.
- Changer de client réinitialise automatiquement la sélection à « Aucun ».
- Le Select est masqué lorsque la facture est créée depuis un devis (`quoteSelected = true`) — le contact proviendra du devis via `createInvoiceFromQuote`.

**Édition** (`/admin/invoices/[id]`) :
- Le Select est toujours visible (client fixé).
- Pré-rempli avec le `contactId` existant de la facture.
- Options : contacts du client de la facture.

### Télécharger un PDF de facture

Le bouton **"Télécharger le PDF"** apparaît uniquement sur les factures dont `issuedAt` est renseigné (factures émises). Les brouillons n'ont pas de bouton — la route retourne 404 pour eux.

**Page détail** (`/admin/invoices/[id]`) : bouton outline dans l'en-tête, à côté du numéro de facture. Le clic déclenche le téléchargement via `<a download>` (même origine → attribut HTML natif, sans redirection).

**Liste** (`/admin/invoices`) : icône `Download` (lucide-react) dans la colonne actions de chaque ligne, à gauche du crayon d'édition, visible uniquement si `issuedAt != null`.

La route servie est : `GET /api/invoices/[id]/file`

Le nom de fichier téléchargé suit le pattern : `facture-{invoice.number}.pdf`

## Architecture interne

### Sélecteur de contact destinataire

- `packages/services/src/client.service.ts` — `listClientContactsByOwner(ownerId)` : requête JOIN `clientContacts ↔ clients` filtrée sur `clients.ownerId = $ownerId AND clients.archivedAt IS NULL`, triée par `(clientId, desc isPrimary, asc name)`. Évite le N+1 sur la page de création ; réutilisable par le formulaire devis (3c).
- `apps/web/app/(admin)/admin/invoices/new/page.tsx` — appelle `listClientContactsByOwner(admin.id)` et passe `contacts` à `InvoiceForm`.
- `apps/web/app/(admin)/admin/invoices/[id]/page.tsx` — appelle `listClientContacts(invoice.clientId)` après résolution de la facture et passe `contacts` à `InvoiceForm`.
- `apps/web/app/(admin)/admin/invoices/_components/InvoiceForm.tsx` — prop `contacts: ClientContact[]`, champ `contactId` géré par react-hook-form, `watch("clientId")` pour filtrer les options et reset à `""` lors du changement de client.

### Résolution des noms de clients dans la liste

La page `/admin/invoices` résout les noms des clients via `getClientNamesByIds(ids)` (sans filtre `archivedAt`). Pour les clients archivés, le suffixe `(archivé)` est ajouté dans la map avant d'être passé à `InvoicesTable` :

```ts
const clientNames = Object.fromEntries(
  Object.entries(namesMap).map(([id, { name, archived }]) => [
    id,
    archived ? `${name} (archivé)` : name,
  ])
);
```

`listClients()` n'est PAS utilisée pour ce cas : elle filtre `archivedAt IS NULL` et est réservée aux Selects de création (on ne crée pas de facture pour un client archivé).

- `packages/services/src/client.service.ts` — `getClientNamesByIds(ids)` : requête `WHERE id IN (...)` sans filtre d'archivage, retourne `Record<string, { name: string; archived: boolean }>`.
- `apps/web/app/(admin)/admin/invoices/page.tsx` — construit la map via `getClientNamesByIds` sur les `clientId` des factures listées.

### Téléchargement PDF

- `apps/web/app/(admin)/admin/invoices/[id]/page.tsx` — Server Component qui charge la facture et rend le bouton conditionnel dans un `flex gap-4` avec le titre `<h1>`.
- `apps/web/app/(admin)/admin/invoices/_components/InvoicesTable.tsx` — colonne `actions` : div flex contenant l'icône Download conditionnelle + le lien Pencil existant.

Le pattern commun : `<Button asChild><a href="/api/invoices/{id}/file" download="facture-{number}.pdf">...</a></Button>`. L'attribut `download` force le téléchargement plutôt que l'ouverture en onglet, même si la route répond `Content-Disposition: inline`.

La route `/api/invoices/[id]/file` n'a pas été modifiée.

## Liens vers tests

- `apps/web/app/(admin)/admin/invoices/_components/__tests__/InvoiceForm.test.tsx` — describe "contact select" : masquage sans client, affichage avec client, reset sur changement client, masquage en mode from-quote, pré-remplissage en édition.
- `packages/services/src/__tests__/client.service.test.ts` — `list_client_contacts_by_owner_returns_filtered_contacts`
- `apps/web/app/(admin)/admin/invoices/[id]/__tests__/page.test.tsx` — describe "Download button" : `shows_download_button_when_issued`, `hides_download_button_when_draft`
- `apps/web/app/(admin)/admin/invoices/_components/__tests__/InvoicesTable.test.tsx` — describe "Download icon" : `shows_download_icon_for_issued_invoice_row`, `hides_download_icon_for_draft_invoice_row`
