# PDF Rendering Infrastructure

## Ce que fait ce module

Fournit la couche de rendu PDF côté serveur basée sur `@react-pdf/renderer` (Node pur, sans Chromium). Expose les primitives visuelles partagées entre factures et devis, ainsi qu'un wrapper `renderToPdfBuffer` pour produire un `Buffer` prêt à l'envoi ou au stockage R2.

Ce module est **server-only** : aucun composant ne peut être importé côté Edge Runtime ou Client Component.

## Comment l'utiliser

### Générer et persister le PDF d'une facture (voie principale)

```ts
import { generateAndStoreInvoicePdf } from "@/lib/pdf/generate-invoice-pdf"

const { pdfKey } = await generateAndStoreInvoicePdf(invoiceId)
// pdfKey = "invoices/2026/06/<uuid>.pdf" — persisté en DB, immuable
```

Comportement garanti :
- **Idempotent** : si `invoice.pdfKey` est déjà défini, retourne la clé existante sans régénérer.
- **Rollback best-effort** : si la persistance DB échoue après l'upload R2, `deletePdfFromR2(key)` est tenté pour éviter les objets orphelins.
- **Guard métier** : lève `BusinessProfileRequiredError` si aucun profil d'entreprise n'est trouvé pour l'émetteur (SIRET/raison sociale obligatoires pour une facture FR).
- **Guard PDF** : `isPdfMagicBytes` + `assertPdfSize` sont appelés avant tout upload.

Erreurs exportées :

| Classe | Condition |
|--------|-----------|
| `InvoiceNotFoundError` | `invoiceId` introuvable en base |
| `ClientNotFoundError` | `invoice.clientId` introuvable |
| `BusinessProfileRequiredError` | `getBusinessProfile(ownerId)` retourne null |

### Générer et persister le PDF d'un devis (voie principale)

```ts
import { generateAndStoreQuotePdf } from "@/lib/pdf/generate-quote-pdf"

const { pdfKey } = await generateAndStoreQuotePdf(quoteId)
// pdfKey = "quotes/2026/06/<uuid>.pdf" — persisté en DB, immuable
```

Comportement garanti :
- **Idempotent** : si `quote.pdfKey` est déjà défini, retourne la clé existante sans régénérer.
- **Rollback best-effort** : si la persistance DB échoue après l'upload R2, `deletePdfFromR2(key)` est tenté pour éviter les objets orphelins.
- **Guard métier** : lève `BusinessProfileRequiredError` si aucun profil d'entreprise n'est trouvé pour l'émetteur.
- **Guard PDF** : `isPdfMagicBytes` + `assertPdfSize` sont appelés avant tout upload.
- **Trigger-agnostique** : n'effectue aucune transition de statut devis — peut être appelé indépendamment depuis n'importe quel contexte.

Erreurs exportées :

| Classe | Condition |
|--------|-----------|
| `QuoteNotFoundError` | `quoteId` introuvable en base |
| `ClientNotFoundError` | `quote.clientId` introuvable |
| `BusinessProfileRequiredError` | `getBusinessProfile(ownerId)` retourne null |

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
| `PdfHeader` | `docType`, `number`, `emitterName`, `logoUrl?`, `accent?` | Bandeau diagonal en tête de document — polygones SVG sombre/accent + logo émetteur à gauche + libellé et numéro à droite |
| `PageFrame` | `children` | Document A4 avec marges 40pt, police Helvetica |
| `PartyBlock` | `label`, `party: BillFrom \| BillTo` | Bloc émetteur ou destinataire — logo en tête si `logoUrl` défini, adresse formatée, email, tél, SIRET/TVA conditionnels |
| `ItemsTable` | `items: PdfLineItem[]` | Tableau Description / Qté / PU HT / Total HT |
| `TotalsBlock` | `totalHtCents`, `vatCents`, `totalTtcCents` | Récapitulatif financier HT / TVA / TTC |
| `LegalFooter` | `text?` | Mentions légales (placeholder jusqu'à R10-1f) |

### Palette PDF

`primitives.tsx` exporte quatre constantes hex utilisables dans tout composant PDF :

| Constante | Valeur | Usage |
|-----------|--------|-------|
| `PDF_DARK` | `#2A2A2A` | Fond du bloc sombre (côté gauche du bandeau) |
| `PDF_ON_DARK` | `#FFFFFF` | Texte sur fond sombre |
| `PDF_ACCENT` | `#D4941A` | Couleur d'accent (primaire app — amber) |
| `PDF_ON_ACCENT` | `#000000` | Texte sur fond accent (foncé pour contraste sur amber) |

### Bandeau diagonal `PdfHeader`

Rendu technique : deux `<Polygon>` SVG superposés en arrière-plan (via `<Svg viewBox="0 0 595.28 95">`), puis deux zones en position absolue par-dessus.

```
┌──────────────────────────────────────────────────────────┐
│ [sombre]        ╱  [accent]                              │
│  logo + nom    ╱    FACTURE / DEVIS                      │
│  émetteur     ╱     numéro                               │
└──────────────╱──────────────────────────────────────────-┘
               ↑ diagonale : 249pt en haut → 226pt en bas
```

- Polygone sombre : `0,0 249,0 226,95 0,95`
- Polygone accent : `249,0 595.28,0 595.28,95 226,95`
- Hauteur bandeau : 95pt
- `logoUrl` absent → seul le nom émetteur est rendu (aucun espace vide)
- `accent` non fourni → fallback sur `PDF_ACCENT`

Câblage dans les documents :

```ts
// InvoicePdf.tsx
<PdfHeader docType="FACTURE" number={model.number} logoUrl={model.billFrom.logoUrl} emitterName={model.billFrom.name} />

// QuotePdf.tsx
<PdfHeader docType="DEVIS" number={model.number} logoUrl={model.billFrom.logoUrl} emitterName={model.billFrom.name} />
```

Le bandeau remplace l'ancien `<Text>` titre (`Facture INV-XXXX` / `Devis DV-XXXX`). Le bloc émetteur détaillé (adresse, SIRET, TVA) reste inchangé en dessous.

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
├── generate-invoice-pdf.ts # Orchestrateur facture : DB → R2 → persistance pdfKey
├── generate-quote-pdf.ts   # Orchestrateur devis : DB → R2 → persistance pdfKey
├── primitives.tsx          # Composants @react-pdf stylés + StyleSheet
├── InvoicePdf.tsx          # Composant facture — assemble les primitives
├── QuotePdf.tsx            # Composant devis — assemble les primitives (expiresAt, statut)
├── render.ts               # renderToPdfBuffer + renderInvoicePdf + renderQuotePdf — server-only
└── __tests__/
    ├── generate-invoice-pdf.test.ts  # 7 tests mock-only : AC1–AC7 (immutabilité, rollback, guard)
    ├── generate-quote-pdf.test.ts    # 6 tests mock-only : AC1–AC6 (immutabilité, rollback, guard)
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

### Orchestrateur `generate-invoice-pdf.ts`

Pipeline complet exposé par `generateAndStoreInvoicePdf` :

```
getInvoiceById → early-return si pdfKey exist
     ↓
Promise.all(listInvoiceItems, getClientById, getBusinessProfile)
     ↓
resolveEmitterLogoDataUri(profile) → logoUrl?  ← best-effort (undefined si absent/erreur)
toEmitterInput(profile) → resolveEmitter({ ...input, logoUrl }) → BillFrom
resolveBillingParty(client) → BillTo
     ↓
toInvoicePdfModel({ invoice, items, billFrom, billTo })
     ↓
renderInvoicePdf(model) → Buffer
     ↓
isPdfMagicBytes + assertPdfSize (garde-fous)
     ↓
buildInvoiceKey() + uploadPdfToR2(key, buffer)
     ↓
setInvoicePdfKey(invoiceId, key)   ← rollback deletePdfFromR2 si rejet
     ↓
return { pdfKey }
```

`toEmitterInput` est un helper local pur qui mappe `BusinessProfile` → `EmitterInput` (name, legalForm, siret, tvaIntra, address, email, phone). Le champ `logoUrl` est résolu de façon asynchrone par l'orchestrateur via `resolveEmitterLogoDataUri` (voir ci-dessous) et injecté dans le `BillFrom` avant le rendu.

**`resolveEmitterLogoDataUri(profile: BusinessProfile): Promise<string | undefined>`** est exporté depuis `generate-invoice-pdf.ts` et réutilisé par `generate-quote-pdf.ts`. Si `profile.logoKey` est null, retourne `undefined`. Sinon, appelle `fetchImageBytesFromR2(logoKey)` et construit un data URI `data:<contentType>;base64,<b64>`. En cas d'erreur R2 (clé absente, timeout, corruption), log structuré et retourne `undefined` — la génération PDF continue sans logo (best-effort). Un logo manquant ne lève jamais d'exception.

**Immutabilité** : les PDF sont figés à la génération (idempotence via `pdfKey`). Un logo ajouté au profil après l'émission d'une facture ou d'un devis n'apparaît pas rétroactivement sur les documents déjà stockés — seulement sur les nouvelles émissions. Comportement légal correct.

La map `STATUS_LABELS` résout le statut enum en libellé FR (`draft → "Brouillon"`, etc.) avant de le passer à `toInvoicePdfModel`, qui est agnostique des traductions.

### Orchestrateur `generate-quote-pdf.ts`

Pipeline complet exposé par `generateAndStoreQuotePdf` (calqué sur la facture, adapté au devis) :

```
getQuoteById → early-return si pdfKey exist
     ↓
listQuoteItems + getClientById + getBusinessProfile
     ↓
resolveEmitterLogoDataUri(profile) → logoUrl?  ← best-effort (undefined si absent/erreur)
toEmitterInput(profile) → resolveEmitter({ ...input, logoUrl }) → BillFrom
resolveBillingParty(client) → BillTo
     ↓
resolveQuoteStatusLabel(quote.status) → libellé FR
toQuotePdfModel({ quote: { ...quote, status: label }, items, billFrom, billTo })
     ↓
renderQuotePdf(model) → Buffer
     ↓
isPdfMagicBytes + assertPdfSize (garde-fous)
     ↓
buildQuoteKey() + uploadPdfToR2(key, buffer)
     ↓
setQuotePdfKey(quoteId, key)   ← rollback deletePdfFromR2 si rejet
     ↓
return { pdfKey }
```

`toEmitterInput` est dupliqué localement depuis `generate-invoice-pdf.ts` (helper pur identique, pas de refactor hors blast radius). `resolveQuoteStatusLabel` est une map locale distincte de `resolveInvoiceStatusLabel` — les enums de statut devis (`draft | sent | accepted | declined | expired`) diffèrent de ceux de la facture.

`setQuotePdfKey` est ajouté à `packages/services/src/quote.service.ts` : `UPDATE quotes SET pdf_key = $key, updated_at = NOW() WHERE id = $quoteId`.

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
| **R10-1e `generate-invoice-pdf`** | ✅ livré | Orchestrateur `generateAndStoreInvoicePdf` + `setInvoicePdfKey` |
| **R10-1g-a `generate-quote-pdf`** | ✅ livré | Orchestrateur `generateAndStoreQuotePdf` + `setQuotePdfKey` (trigger-agnostique) |
| R10-1e-e `pdf-logo-embedding` | ✅ livré | Logo émetteur via `resolveEmitterLogoDataUri` (data URI best-effort) dans `PartyBlock` |
| R10-1f-b `emit-invoice` | ✅ livré | Pré-check émetteur + génération PDF synchrone best-effort au passage `draft→sent` (via `transitionInvoiceStatusAction`) |
| **R10-1g-a `invoice-pdf-route`** | ✅ livré | Route Handler `GET /api/invoices/[id]/file` — stream R2 inline + régénération paresseuse si `pdfKey` null et `issuedAt` set + lien réel dans `InvoiceRow` |
| **R10-1g-b `emit-quote`** | ✅ livré | Pré-check émetteur + génération PDF synchrone best-effort au passage `draft→sent` (via `transitionQuoteStatusAction`) |
| R10-1h-quote `quote-pdf-route` | 🔜 | Route Handler `GET /api/quotes/[id]/file` — stream R2 inline |

## Liens vers tests

- `apps/web/lib/pdf/__tests__/generate-invoice-pdf.test.ts` — 10 tests mock-only : retour pdfKey, immutabilité, BusinessProfileRequiredError, rollback R2, setInvoicePdfKey, ordre guards + logo data URI injecté dans billFrom, logoUrl undefined si pas de logoKey, logo fetch failure best-effort (génération continue)
- `apps/web/lib/pdf/__tests__/generate-quote-pdf.test.ts` — 9 tests mock-only : retour pdfKey, immutabilité (pdfKey set → pas de render/upload), BusinessProfileRequiredError, rollback R2 (setQuotePdfKey rejet → deletePdfFromR2), ordre guards + logo data URI injecté dans billFrom, logoUrl undefined si pas de logoKey, logo fetch failure best-effort (génération continue)
- `apps/web/app/actions/__tests__/quotes.test.ts` — 5 tests émission : pré-check profil null bloque la transition (AC1), draft→sent génère PDF après transition (AC2), échec PDF n'est pas bloquant (AC3), transitions non-sent ignorent pré-check et PDF (AC4), quote introuvable au pré-check (AC5)
- `apps/web/lib/pdf/__tests__/primitives.test.tsx` — 10 tests : PageFrame, PartyBlock (BillFrom complet, BillTo minimal, BillFrom avec logoUrl → Image rendu, BillFrom sans logoUrl → pas d'Image), ItemsTable (items + tableau vide), TotalsBlock ; + palette PDF (`pdf_palette_constants_are_hex_strings`) ; + `PdfHeader` (rendu avec/sans logo)
- `apps/web/lib/pdf/__tests__/render.test.ts` — smoke test `renderToPdfBuffer` retourne un Buffer avec magic bytes `%PDF`
- `apps/web/lib/pdf/__tests__/invoice-pdf.test.tsx` — test end-to-end `renderInvoicePdf` : buffer `%PDF`, number et nom de partie présents dans le texte extrait
- `packages/services/src/__tests__/invoice-pdf.shared.test.ts` (ou voisin) — tests purs `toInvoicePdfModel` : tri sortOrder, calcul lignes, TTC via computeInvoiceTtc, dates null, notes absentes
- `apps/web/lib/pdf/__tests__/quote-pdf.test.tsx` — test end-to-end `renderQuotePdf` : buffer `%PDF`, number et nom émetteur présents dans le texte extrait
- `packages/services/src/__tests__/quote-pdf.shared.test.ts` — 5 tests purs `toQuotePdfModel` : tri sortOrder, calcul lignes, TTC via computeQuoteTtc, notes null/texte, dates null

### Helper d'extraction texte

`apps/web/lib/pdf/__tests__/_pdf-text.ts` expose `extractPdfText(buffer)` : inflate FlateDecode → decode opérateurs hex TJ/Tj → texte brut. Partagé par `primitives.test.tsx` et `invoice-pdf.test.tsx`.
