# Clients

## Ce que fait le module Clients

Gestion des clients de l'admin solo : création, édition des informations (nom, type, email, téléphone, adresse de facturation structurée, identité d'entreprise, notes), gestion des accès portail (contacts, invitations), et visualisation de l'historique devis et factures associés.

## Comment l'utiliser

Accès via `/admin/clients` (liste) et `/admin/clients/[id]` (fiche détail).

La fiche détail expose trois zones :

1. **Formulaire d'édition** — informations du client.
2. **Accès portail** — contacts du client et statut invitation.
3. **Section Devis** — tableau des devis du client triés par date d'émission desc. Colonnes : Numéro, Statut, Émis le, Montant TTC. Chaque ligne est un lien vers `/admin/quotes/[id]`. Affiche "Aucun devis pour ce client." si vide.
4. **Section Factures** — tableau des factures du client triées par date d'émission desc. Colonnes : Numéro, Statut, Émis le, Échéance, Montant TTC, Payé le. Chaque ligne est un lien vers `/admin/invoices/[id]`. Affiche "Aucune facture pour ce client." si vide.

## Adresse de facturation structurée

La colonne `billing_address` est un jsonb typé `PostalAddress` (défini dans `packages/db/src/schema.ts`). Le formulaire expose six champs distincts :

| Champ React Hook Form | Colonne DB | Description |
|---|---|---|
| `billingAddress.line1` | `billing_address.line1` | Numéro et nom de rue (obligatoire si adresse renseignée) |
| `billingAddress.line2` | `billing_address.line2` | Complément (bâtiment, appartement…) |
| `billingAddress.postalCode` | `billing_address.postalCode` | Code postal |
| `billingAddress.city` | `billing_address.city` | Ville |
| `billingAddress.state` | `billing_address.state` | État / Région |
| `billingAddress.country` | `billing_address.country` | Pays |

Tous les champs sont optionnels. Un formulaire soumis sans aucun champ adresse envoie `billingAddress: undefined` (absent du patch Drizzle).

La clé Zod et la clé Drizzle sont identiques (`billingAddress`) — le spread `.set({ ...patch })` écrit directement la colonne `billing_address` sans mapping supplémentaire.

Pour le rendu PDF, `resolveBillingParty(client)` → `parseAddressJsonb(client.billingAddress)` normalise l'objet en `PostalAddress` (voir `docs/billing-party.md`).

## Identité d'entreprise (clients `company`)

Les clients de type `company` peuvent porter trois champs d'identité légale, alignés sur les colonnes équivalentes de `businessProfiles` (l'émetteur) :

| Champ React Hook Form | Colonne DB | Description |
|---|---|---|
| `siret` | `siret` (TEXT NULL) | Numéro SIRET (14 chiffres) |
| `tvaIntra` | `tva_intra` (TEXT NULL) | Numéro de TVA intracommunautaire |
| `legalForm` | `legal_form` (TEXT NULL) | Forme juridique (ex. SASU, SAS, SARL…) |

Ces champs sont **optionnels** (nullable) — aucun backfill sur les clients existants, les clients étrangers ou sans SIRET restent valides.

**Visibilité conditionnelle** : dans `ClientForm`, les trois champs sont affichés uniquement quand `type === "company"`. Pour un client `individual`, ils sont absents du DOM et leurs valeurs sont nettoyées à `null` au submit — un particulier ne porte jamais de SIRET ni de forme juridique.

Ces colonnes alimenteront le bloc `BillTo` du PDF dans la feature `feat-client-company-pdf-recipient` (le type `BillTo` de `billing-party.shared` expose déjà `siret?` et `tvaIntra?`).

## Gestion des contacts portail (CRUD)

La section "Accès portail" de la fiche client expose le CRUD complet des contacts.

### Service (`packages/services/src/client.service.ts`)

| Fonction | Signature | Comportement |
|---|---|---|
| `listClientContacts(clientId)` | `→ ClientContact[]` | Tri déterministe : `isPrimary DESC`, `name ASC` |
| `addClientContact(input)` | `→ ClientContact` | Crée un contact (sans compte portail) |
| `updateClientContact(id, patch)` | `→ ClientContact` | Met à jour name/email/role/isPrimary |
| `deleteClientContact(contactId)` | `→ void` | Supprime par `id` du contact (transaction : purge les dépendances FK en amont) |
| `removeClientContact(clientId, userId)` | `→ void` | Supprime par `userId` — flux portail existant, conservé |

`deleteClientContact` opère en transaction : supprime d'abord les lignes dépendantes (ex. invitations référençant `contactId`), puis le contact. Ne jamais l'utiliser à la place de `removeClientContact` pour un contact avec compte portail actif.

### Schémas Zod (`apps/web/lib/schemas/client.schemas.ts`)

| Schéma | Dérivation |
|---|---|
| `addClientContactSchema` | Base — inclut `clientId` (obligatoire) |
| `updateClientContactSchema` | `addClientContactSchema.omit({clientId}).partial()` — tous les champs optionnels, `clientId` non modifiable |

### Server Actions (`apps/web/app/actions/clients.ts`)

| Action | Signature | Garde |
|---|---|---|
| `updateClientContactAction(contactId, input)` | `→ ActionResult` | `requireAdmin` ; rejette si email dupliqué sur un *autre* contact du même client (`EMAIL_ALREADY_EXISTS`) |
| `deleteClientContactAction(contactId, clientId)` | `→ ActionResult` | `requireAdmin` ; idempotent (pas de garde IDOR) |

Les deux actions appellent `revalidatePath(/admin/clients/${clientId})` et suivent le pattern `try/catch → ok/fail/handleActionError` cohérent avec `addClientContactAction`.

## Architecture interne

La page `apps/web/app/(admin)/admin/clients/[id]/page.tsx` est un Server Component. Les données sont chargées en parallèle via `Promise.all` :

```ts
const [contacts, quotes, invoices] = await Promise.all([
  listClientContacts(id),
  listQuotes({ clientId: id }),
  listInvoices({ clientId: id }),
]);
```

Les sections devis et factures sont rendues par deux Server Components dédiés :

- `_components/ClientQuotesSection.tsx` — reçoit `quotes: Quote[]` en props.
- `_components/ClientInvoicesSection.tsx` — reçoit `invoices: Invoice[]` en props.

Les helpers `formatCurrency` / `formatDate` viennent de `@/lib/format`. Les montants TTC sont calculés via `computeQuoteTtc` / `computeInvoiceTtc` depuis `@saas/services`.

## Liens vers tests

- `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientQuotesSection.test.tsx`
- `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientInvoicesSection.test.tsx`
- `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientForm.test.tsx` — soumet `billingAddress` comme objet structuré, vérifie l'absence de la clé `address`
- `packages/services/src/__tests__/client.service.test.ts` — persistance create/update billingAddress, round-trip via `resolveBillingParty` ; `deleteClientContact` par contactId ; `listClientContacts` ordre isPrimary desc + name asc
- `apps/web/lib/schemas/__tests__/client.schemas.test.ts` — validation Zod `billingAddress` object / optionnel / clé `address` ignorée ; identité entreprise (`siret`, `tvaIntra`, `legalForm`) optionnels et acceptent chaîne vide ; `updateClientContactSchema` partiel sans `clientId`
- `apps/web/app/(admin)/admin/clients/_components/__tests__/ClientForm.test.tsx` — visibilité conditionnelle des champs identité selon `type`, strip au submit pour `individual`
