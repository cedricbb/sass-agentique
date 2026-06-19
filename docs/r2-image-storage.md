# R2 Image Storage

## Ce que fait ce module

`apps/web/lib/storage/r2.ts` expose des helpers image (PNG/JPG uniquement) pour uploader et récupérer des images depuis Cloudflare R2. Première cible : le logo de l'émetteur (business profile).

Les helpers PDF du même fichier restent inchangés.

## Comment l'utiliser

### Valider et préparer un logo

```ts
import {
  detectImageFormat,
  imageContentType,
  assertImageSize,
  buildLogoKey,
  uploadImageToR2,
} from "@/lib/storage/r2"

const format = detectImageFormat(buffer)
if (!format) throw new Error("Format non supporté — PNG ou JPEG uniquement")

assertImageSize(buffer)                         // lève FileTooLargeError si > 2 MB
const key = buildLogoKey(ownerId)               // "business-profiles/<ownerId>/logo"
const ct  = imageContentType(format)            // "image/png" | "image/jpeg"
await uploadImageToR2(key, buffer, ct)
```

La clé logo est **stable par owner** : ré-uploader écrase l'objet précédent, zéro orphelin.

### Lire un logo (ex. embedding PDF)

```ts
import { buildLogoKey, fetchImageBytesFromR2 } from "@/lib/storage/r2"

const key = buildLogoKey(ownerId)
const { buffer, contentType } = await fetchImageBytesFromR2(key)
// buffer est un Buffer Node.js — prêt pour @react-pdf/renderer Image
```

`fetchImageBytesFromR2` lève `R2NotFoundError` si la clé est absente.

## Architecture interne

### Détection de format — magic bytes

`detectImageFormat` inspecte les premiers octets sans dépendance externe :

| Format | Magic bytes attendus |
|--------|----------------------|
| PNG    | `89 50 4E 47` (4 octets min) |
| JPEG   | `FF D8 FF` (3 octets min) |

Retourne `null` pour tout autre format (SVG inclus — non supporté pour l'embedding PDF).

### Clé logo — singleton par owner

```
business-profiles/<ownerId>/logo
```

Pas d'extension dans la clé : le format est porté par le `ContentType` de l'objet R2. Une seule clé par owner → pas de nettoyage d'anciens logos.

### Lecture en Buffer (vs stream PDF)

`streamPdfFromR2` retourne un `ReadableStream` (adapté au streaming HTTP). `fetchImageBytesFromR2` utilise `transformToByteArray()` du SDK S3 et retourne un `Buffer` Node.js — nécessaire pour l'embedding `@react-pdf/renderer`.

### Erreurs

| Situation | Erreur levée |
|-----------|--------------|
| Fichier > 2 MB | `FileTooLargeError` |
| Upload échoue | `R2UploadError` |
| Clé absente (NoSuchKey / 404) | `R2NotFoundError` |

## Liens vers tests

- `apps/web/lib/storage/__tests__/r2.test.ts` — couverture `detectImageFormat`, `imageContentType`, `assertImageSize`, `buildLogoKey`, `uploadImageToR2`, `fetchImageBytesFromR2`
