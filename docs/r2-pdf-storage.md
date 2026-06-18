# R2 PDF Storage

## Ce que fait ce module

`apps/web/lib/storage/r2.ts` centralise toutes les interactions avec Cloudflare R2 pour les fichiers PDF générés par l'application : upload, streaming, construction des clés d'objet.

Trois entités sont supportées : **reports**, **invoices**, **quotes**. Chaque entité a son propre préfixe de clé.

## Comment l'utiliser

### Constructeurs de clés

```ts
import { buildReportKey, buildInvoiceKey, buildQuoteKey } from "@/lib/storage/r2"

const key = buildInvoiceKey()  // "invoices/2026/06/<uuid>.pdf"
const key = buildQuoteKey()    // "quotes/2026/06/<uuid>.pdf"
const key = buildReportKey()   // "reports/2026/06/<uuid>.pdf"
```

Format garanti : `<prefix>/YYYY/MM/<uuid-v4>.pdf`

Les clés contiennent un UUID aléatoire non re-dérivable → **doivent être persistées en base** après génération (colonnes `pdfKey` sur `invoices` et `quotes`, `filePath` sur `reports`).

### Upload

```ts
import { uploadPdfToR2 } from "@/lib/storage/r2"

const key = buildInvoiceKey()
await uploadPdfToR2(key, pdfBuffer)
```

### Streaming (Route Handler)

```ts
import { streamPdfFromR2 } from "@/lib/storage/r2"

const stream = await streamPdfFromR2(key)
return new Response(stream, { headers: { "Content-Type": "application/pdf" } })
```

`streamPdfFromR2` lève `R2NotFoundError` si la clé est absente du bucket.

## Architecture interne

### Helper privé `buildPdfKey`

Les trois constructeurs délèguent à un helper interne non exporté :

```ts
function buildPdfKey(prefix: string): string {
  const now = new Date()
  const yyyy = now.getFullYear().toString()
  const mm = (now.getMonth() + 1).toString().padStart(2, "0")
  return `${prefix}/${yyyy}/${mm}/${crypto.randomUUID()}.pdf`
}
```

`buildReportKey` accepte un paramètre `_filename` ignoré (rétrocompatibilité) — il délègue à `buildPdfKey("reports")`.

### Colonnes DB associées

| Table      | Colonne   | Type          | Valeur null         |
|------------|-----------|---------------|---------------------|
| `invoices` | `pdf_key` | `text` (nullable) | PDF pas encore généré |
| `quotes`   | `pdf_key` | `text` (nullable) | PDF pas encore généré |
| `reports`  | `file_path` | `text` (not null) | Émission obligatoire |

`null` sur `pdfKey` indique qu'aucun PDF n'a encore été généré pour ce document. Les routes `/api/invoices/[id]/file` et `/api/quotes/[id]/file` appliquent une **régénération paresseuse** : si `pdfKey == null` mais `issuedAt != null` (document émis), `generateAndStoreInvoicePdf` / `generateAndStoreQuotePdf` est appelé à la première consultation. Si `pdfKey == null` et `issuedAt == null` (brouillon), la route retourne 404 sans régénérer.

### Variables d'environnement requises

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

## Liens vers tests

- `apps/web/lib/storage/__tests__/r2.test.ts` — couverture `buildReportKey`, `buildInvoiceKey`, `buildQuoteKey`, `uploadPdfToR2`, `streamPdfFromR2`, `R2NotFoundError`
