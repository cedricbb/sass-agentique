# Admin — Factures

## Ce que fait ce module

Gestion complète des factures côté admin : liste paginée avec filtres, page détail par facture (édition, cycle de vie, lignes, montants, paiements), téléchargement PDF des factures émises, et sélection du contact destinataire (« À l'attention de »).

## Comment l'utiliser

### Sélectionner le contact destinataire

Le formulaire de facture expose un Select **"Destinataire (contact)"** permettant de cibler un contact spécifique du client (ex. : « À l'attention de … » dans le PDF à venir).

**Création** (`/admin/invoices/new`) :
- Le Select n'apparaît que lorsqu'un client est choisi.
- Options : « Aucun (entreprise seule) » + les contacts du client sélectionné.
- Si le client possède un contact principal (`isPrimary = true`), il est **pré-sélectionné automatiquement** dès la sélection du client.
- Si le client n'a pas de contact principal, le Select reste sur « Aucun (entreprise seule) ».
- Changer de client re-pré-sélectionne le contact principal du nouveau client (ou « Aucun » si absent).
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
- `apps/web/app/(admin)/admin/invoices/_components/InvoiceForm.tsx` — prop `contacts: ClientContact[]`, champ `contactId` géré par react-hook-form. Le handler `handleClientChange` (mode création uniquement) résout `contacts.find(c => c.clientId === value && c.isPrimary)?.id ?? NONE_CONTACT_VALUE` pour pré-sélectionner le contact principal ou retomber sur « Aucun ».

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

### Isolation par owner (lecture)

La liste et le détail admin des factures sont scopés à l'owner courant — un owner ne voit ni ne peut accéder par URL directe aux factures d'un autre owner.

- `packages/services/src/invoice.service.ts` — `listInvoices(opts?)` accepte un filtre optionnel `ownerId` dans `ListInvoicesOptions` (aux côtés de `clientId`/`status`), composé en clause `eq(invoices.ownerId, opts.ownerId)`. `getInvoiceByIdForOwner(id, ownerId)` (nouvelle fonction, `ownerId` obligatoire) retourne `null` si l'id est malformé, si la facture n'existe pas, ou si elle appartient à un autre owner — les trois cas sont indistinguables (anti-IDOR, jamais de 403 qui confirmerait l'existence).
- `apps/web/app/(admin)/admin/invoices/page.tsx` — `requireAdmin()` + `listInvoices({ ownerId: user.id })`.
- `apps/web/app/(admin)/admin/invoices/[id]/page.tsx` — `requireAdmin()` + `getInvoiceByIdForOwner(id, user.id)` ; `if (!invoice) notFound()` existant suffit tel quel (404 uniforme, gratuit).
- Pattern répliqué : clause `eq(table.ownerId, ownerId)` inline dans le service, comme `listClientsByOwner` (`client.service.ts`) — pas de helper générique.

**`getInvoiceById(id)` et `transitionInvoiceStatus` restent volontairement non scopées.** Elles sont appelées par les handlers Inngest de traitement des webhooks Stripe (`payment-intent-succeeded.ts`, `payment-intent-failed.ts`, `stripe-events-poll-fallback.ts`), qui n'ont pas de session admin ni de `user.id` disponible — leur frontière de confiance est la signature Stripe vérifiée, pas l'ownership. Ne pas les faire migrer vers un scoping owner sans avoir audité précisément ces call sites.

Les mutations (édition, transition de statut, lignes de facture) ne sont pas couvertes par ce scoping — chantier séparé.

## Liens vers tests

- `apps/web/app/(admin)/admin/invoices/_components/__tests__/InvoiceForm.test.tsx` — describe "contact select" : masquage sans client, affichage avec client, pré-sélection contact principal au changement client, masquage en mode from-quote, pré-remplissage en édition.
- `apps/web/tests/e2e/admin-preselect-contact.spec.ts` — tests Playwright : pré-sélection facture/devis, fallback sans contact principal, re-pré-sélection au changement de client.
- `packages/services/src/__tests__/client.service.test.ts` — `list_client_contacts_by_owner_returns_filtered_contacts`
- `apps/web/app/(admin)/admin/invoices/[id]/__tests__/page.test.tsx` — describe "Download button" : `shows_download_button_when_issued`, `hides_download_button_when_draft`
- `apps/web/app/(admin)/admin/invoices/_components/__tests__/InvoicesTable.test.tsx` — describe "Download icon" : `shows_download_icon_for_issued_invoice_row`, `hides_download_icon_for_draft_invoice_row`
- `packages/services/src/__tests__/invoice.service.test.ts` — `getInvoiceByIdForOwner` (id malformé, inexistant, cross-owner, nominal), `listInvoices` filtre `ownerId`
- `tests/e2e/invoices-isolation.spec.ts` — isolation `/admin/invoices` : owner A voit sa facture seed, owner B voit une liste vide, owner B reçoit 404 sur l'URL directe d'une facture owner A
