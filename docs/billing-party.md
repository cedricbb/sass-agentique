# billing-party.shared

## Ce que fait billing-party.shared

Fournit les types contractuels et les résolveurs purs qui normalisent les données
émetteur/destinataire pour la génération PDF de devis et factures (R10).
Découple le rendu PDF des tables Drizzle : le template PDF se lie à `BillTo`/`BillFrom`,
jamais à `clients`/`invoices` directement. Les futures évolutions de schéma (R10-3 :
ajout SIRET/TVA inter, M2M contact↔entreprise) ne nécessiteront aucun rework du template.

## Comment l'utiliser

```ts
import {
  resolveBillingParty,
  resolveEmitter,
  formatPostalAddress,
  type BillTo,
  type BillFrom,
  type PostalAddress,
  type ClientForBilling,
  type EmitterInput,
} from "@saas/services/billing-party.shared"

// Résoudre le destinataire (client + contact optionnel chargés depuis DB par l'appelant)
const contact = invoice.contactId
  ? await getClientContactWithUser(invoice.contactId)
  : null
const billTo: BillTo = resolveBillingParty(client, contact)

// Résoudre l'émetteur (depuis config env ou future table business_profile)
const billFrom: BillFrom = resolveEmitter({
  name: process.env.COMPANY_NAME ?? "",
  address: { line1: process.env.COMPANY_ADDRESS },
  siret: process.env.COMPANY_SIRET,
  tvaIntra: process.env.COMPANY_TVA,
})

// Formater une adresse en lignes prêtes à rendre
const lines: string[] = formatPostalAddress(billTo.address)
// → ["1 rue de la Paix", "75001 Paris", "France"]
```

## Architecture interne

**Types exportés**

| Type | Rôle |
|------|------|
| `PostalAddress` | Adresse postale normalisée (tous champs optionnels) |
| `BillFrom` | Émetteur : infos légales FR (name, legalForm, siret, tvaIntra, logoUrl, …) |
| `BillTo` | Destinataire : name, type (company\|individual), address, siret?, tvaIntra?, attention? |
| `ClientForBilling` | Sous-ensemble structurel de `Client` consommé par `resolveBillingParty` (inclut siret?, tvaIntra?) |
| `EmitterInput` | Entrée source-agnostique de `resolveEmitter` |

**Fonctions exportées**

| Fonction | Comportement |
|----------|-------------|
| `parseAddressJsonb(raw)` | Normalise `clients.billingAddress` (jsonb) en `PostalAddress`. Tolère : string legacy → `{line1}`, objet structuré → extraction sélective, null/undefined → `{}`. Jamais de crash. |
| `resolveBillingParty(client, contact?)` | Mappe `ClientForBilling` → `BillTo`. Délègue l'adresse à `parseAddressJsonb`. Mappe `client.siret`/`tvaIntra` → `BillTo.siret`/`tvaIntra`. Mappe `contact?.name` → `BillTo.attention`. Second param optionnel : les appelants sans contact restent non cassés. |
| `resolveEmitter(input)` | Mappe `EmitterInput` → `BillFrom`. L'appelant est responsable de sourcer les données (env ou future table). |
| `formatPostalAddress(addr)` | Retourne un tableau de lignes non-vides : `[line1, line2, "zip city", state, country]`. |

**Invariants de design**
- `PostalAddress` est importé depuis `@saas/db` via `import type` (erasure à la compilation — zéro dépendance runtime vers `@saas/db`, `drizzle-orm` ou toute dépendance I/O).
- `siret`/`tvaIntra` sur `BillTo` sont alimentés depuis `client.siret`/`client.tvaIntra` (nullish → undefined). `attention` porte le nom du contact destinataire si fourni par l'appelant.
- La source de `EmitterInput` (config env vs future table `business_profile`) est délibérément hors scope — arbitrage R10-1d.

## Liens vers tests

`packages/services/src/__tests__/billing-party.shared.test.ts`

13 cas unitaires couvrant : company avec adresse string, adresse null, jsonb structuré,
siret/tvaIntra mappés depuis client, siret absent → undefined, attention depuis contact,
sans contact (backward compat), émetteur complet, émetteur avec champs optionnels absents,
émetteur iban/bic, formatPostalAddress complet, vide, ordre complet.
