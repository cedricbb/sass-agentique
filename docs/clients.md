# Clients

## Ce que fait le module Clients

Gestion des clients de l'admin solo : création, édition des informations (nom, type, email, téléphone, adresse, notes), gestion des accès portail (contacts, invitations), et visualisation de l'historique devis et factures associés.

## Comment l'utiliser

Accès via `/admin/clients` (liste) et `/admin/clients/[id]` (fiche détail).

La fiche détail expose trois zones :

1. **Formulaire d'édition** — informations du client.
2. **Accès portail** — contacts du client et statut invitation.
3. **Section Devis** — tableau des devis du client triés par date d'émission desc. Colonnes : Numéro, Statut, Émis le, Montant TTC. Chaque ligne est un lien vers `/admin/quotes/[id]`. Affiche "Aucun devis pour ce client." si vide.
4. **Section Factures** — tableau des factures du client triées par date d'émission desc. Colonnes : Numéro, Statut, Émis le, Échéance, Montant TTC, Payé le. Chaque ligne est un lien vers `/admin/invoices/[id]`. Affiche "Aucune facture pour ce client." si vide.

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
