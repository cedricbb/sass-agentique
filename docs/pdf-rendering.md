# PDF Rendering Infrastructure

## Ce que fait ce module

Fournit la couche de rendu PDF côté serveur basée sur `@react-pdf/renderer` (Node pur, sans Chromium). Expose les primitives visuelles partagées entre factures et devis, ainsi qu'un wrapper `renderToPdfBuffer` pour produire un `Buffer` prêt à l'envoi ou au stockage R2.

Ce module est **server-only** : aucun composant ne peut être importé côté Edge Runtime ou Client Component.

## Comment l'utiliser

### Rendu d'une facture (voie haute — recommandée)

```ts
import { toInvoicePdfModel } from "@saas/services/invoice-pdf.shared"
import { renderInvoicePdf } from "@/lib/pdf/render"

const model = toInvoicePdfModel({ invoice, items, billFrom, billTo })
const buffer = await renderInvoicePdf(model)
```

`toInvoicePdfModel` est une fonction pure (zero DB/R2/@react-pdf) :
trie les items par `sortOrder`, calcule les totaux via `computeInvoiceTtc`, et retourne un `InvoicePdfModel` prêt au rendu.

### Rendu d'un devis (voie haute — recommandée)

```ts
import { toQuotePdfModel } from "@saas/services/quote-pdf.shared"
import { renderQuotePdf } from "@/lib/pdf/render"

const model = toQuotePdfModel({ quote, items, billFrom, billTo })
const buffer = await renderQuotePdf(model)
```

`toQuotePdfModel` est une fonction pure (zero DB/R2/@react-pdf) :
trie les items par `sortOrder`, calcule les totaux via `computeQuoteTtc`, et retourne un `QuotePdfModel` prêt au rendu. Le devis expose `expiresAt` (à la place de `dueAt` pour la facture) et un `status` parmi `draft | sent | accepted | declined | expired`.

### Rendu bas-niveau (primitives directes)

```ts
import { renderToPdfBuffer } from "@/lib/pdf/render"
import { PageFrame, PartyBlock, ItemsTable, TotalsBlock, LegalFooter } from "@/lib/pdf/primitives"

const element = (
  <PageFrame>
    <PartyBlock label="ÉMETTEUR" party={billFrom} />
    <PartyBlock label="DESTINATAIRE" party={billTo} />
    <ItemsTable items={lineItems} />
    <TotalsBlock totalHtCents={ht} vatCents={vat} totalTtcCents={ttc} />
    <LegalFooter />
  </PageFrame>
)

const buffer = await renderToPdfBuffer(element)
```

### Primitives disponibles

| Composant | Props | Rôle |
|-----------|-------|------|
| `PageFrame` | `children` | Document A4 avec marges 40pt, police Helvetica |
| `PartyBlock` | `label`, `party: BillFrom \| BillTo` | Bloc émetteur ou destinataire — adresse formatée, email, tél, SIRET/TVA conditionnels |
| `ItemsTable` | `items: PdfLineItem[]` | Tableau Description / Qté / PU HT / Total HT |
| `TotalsBlock` | `totalHtCents`, `vatCents`, `totalTtcCents` | Récapitulatif financier HT / TVA / TTC |
| `LegalFooter` | `text?` | Mentions légales (placeholder jusqu'à R10-1f) |

### Type `PdfLineItem`

```ts
type PdfLineItem = {
  description: string
  quantity: number
  unitPriceHtCents: number
  totalHtCents: number
}
```

Les montants sont exprimés en centimes entiers. La conversion `centsToEur` est interne au module.

## Architecture interne

### Dépendance

`@react-pdf/renderer@4.5.1` — pinné en `apps/web/package.json` pour garantir la compatibilité React 19 / Next 15. Les versions antérieures ont des peer deps React 18 incompatibles.

### Fichiers

```
packages/services/src/
├── invoice-pdf.shared.ts   # toInvoicePdfModel — pur, zéro dépendance PDF/DB
└── quote-pdf.shared.ts     # toQuotePdfModel — pur, zéro dépendance PDF/DB

apps/web/lib/pdf/
├── primitives.tsx          # Composants @react-pdf stylés + StyleSheet
├── InvoicePdf.tsx          # Composant facture — assemble les primitives
├── QuotePdf.tsx            # Composant devis — assemble les primitives (expiresAt, statut)
├── render.ts               # renderToPdfBuffer + renderInvoicePdf + renderQuotePdf — server-only
└── __tests__/
    ├── _pdf-text.ts         # Helper partagé : inflate FlateDecode + decode hex TJ
    ├── primitives.test.tsx  # Rendu → Buffer, extraction texte via zlib inflate
    ├── invoice-pdf.test.tsx # Test end-to-end InvoicePdf (number, partie, montant)
    ├── quote-pdf.test.tsx   # Test end-to-end QuotePdf (number, partie)
    └── render.test.ts       # Smoke test renderToPdfBuffer
```

### Contraintes runtime

- `render.ts` est marqué `import "server-only"` — interdit en Edge Runtime et Client Components.
- `@react-pdf/renderer` embarque Yoga Layout (WASM) — pas compatible Edge.
- Police par défaut : Helvetica (intégrée, aucun enregistrement `Font.register` requis).

### Adaptateurs `invoice-pdf.shared` et `quote-pdf.shared`

`toInvoicePdfModel` et `toQuotePdfModel` vivent dans `@saas/services` (hors de `apps/web`) pour rester testables sans runtime @react-pdf.

Règles communes :
- Tri des items par `sortOrder` croissant (copie — pas de mutation du tableau d'entrée).
- Délégation des totaux à `computeInvoiceTtc` / `computeQuoteTtc` (invariant montants centralisé, aucun recalcul manuel).
- `status` passé tel quel (libellé déjà résolu par l'appelant — les mappers sont agnostiques des traductions UI).

Différences devis vs facture :
- Le devis expose `expiresAt: Date | null` (à la place de `dueAt`), `acceptedAt`, et un statut enum `draft | sent | accepted | declined | expired`.
- Les totaux du devis passent par `computeQuoteTtc` (pas `computeInvoiceTtc`).
- Les items devis ont `unitPriceEurCents` (même sémantique que la facture).

### Montants

Tous les montants transitent en centimes entiers (`number`). L'adaptateur `toInvoicePdfModel` délègue à `computeInvoiceTtc` de `invoice.shared`. Ce module ne calcule pas.

### BillTo / BillFrom

Importés depuis `@saas/services/billing-party.shared`. Le sous-chemin est exposé via l'export `"./billing-party.shared"` du `package.json` de `@saas/services`.

## Maillons amont / aval

| Maillon | Statut | Rôle |
|---------|--------|------|
| R10-1a `billing-party.shared` | ✅ livré | Fournit `BillTo`, `BillFrom`, `formatPostalAddress` |
| **R10-1c-a** (ce module) | ✅ livré | Primitives + `renderToPdfBuffer` |
| R10-1c-b `InvoicePdf` | ✅ livré | Composant facture + `renderInvoicePdf` + mapper pur |
| R10-1c-c `QuotePdf` | ✅ livré | Composant devis + `renderQuotePdf` + mapper pur |
| R10-1f `business_profile` | 🔜 | Émetteur réel + logo dans `LegalFooter` / `PartyBlock` |

## Liens vers tests

- `apps/web/lib/pdf/__tests__/primitives.test.tsx` — 5 tests : PageFrame, PartyBlock (BillFrom complet, BillTo minimal), ItemsTable (items + tableau vide), TotalsBlock
- `apps/web/lib/pdf/__tests__/render.test.ts` — smoke test `renderToPdfBuffer` retourne un Buffer avec magic bytes `%PDF`
- `apps/web/lib/pdf/__tests__/invoice-pdf.test.tsx` — test end-to-end `renderInvoicePdf` : buffer `%PDF`, number et nom de partie présents dans le texte extrait
- `packages/services/src/__tests__/invoice-pdf.shared.test.ts` (ou voisin) — tests purs `toInvoicePdfModel` : tri sortOrder, calcul lignes, TTC via computeInvoiceTtc, dates null, notes absentes
- `apps/web/lib/pdf/__tests__/quote-pdf.test.tsx` — test end-to-end `renderQuotePdf` : buffer `%PDF`, number et nom émetteur présents dans le texte extrait
- `packages/services/src/__tests__/quote-pdf.shared.test.ts` — 5 tests purs `toQuotePdfModel` : tri sortOrder, calcul lignes, TTC via computeQuoteTtc, notes null/texte, dates null

### Helper d'extraction texte

`apps/web/lib/pdf/__tests__/_pdf-text.ts` expose `extractPdfText(buffer)` : inflate FlateDecode → decode opérateurs hex TJ/Tj → texte brut. Partagé par `primitives.test.tsx` et `invoice-pdf.test.tsx`.
