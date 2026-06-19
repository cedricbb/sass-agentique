# business-profile

## Ce que fait business-profile

Stocke l'identité légale de l'émetteur (propriétaire du compte freelance) pour la génération PDF de devis et factures.
Une ligne par `ownerId` (contrainte unique) — singleton multi-tenant prêt pour V2.
Le champ `logoKey` référence une clé R2 (upload géré en R10-1e).

## Comment l'utiliser

```ts
import {
  getBusinessProfile,
  upsertBusinessProfile,
  setBusinessProfileLogoKey,
  type UpsertBusinessProfileInput,
} from "@saas/services"

// Lecture — retourne null si aucun profil n'existe encore
const profile = await getBusinessProfile(ownerId)

// Création ou mise à jour (singleton par owner — onConflictDoUpdate)
const updated = await upsertBusinessProfile(ownerId, {
  name: "Studio Lambda",
  legalForm: "SASU",
  siret: "12345678901234",
  tvaIntra: "FR12345678901",
  address: { line1: "12 rue de la Paix", city: "Paris", zip: "75001", country: "FR" },
  email: "contact@studio-lambda.fr",
  phone: "+33 1 23 45 67 89",
  iban: "FR76 3000 6000 0112 3456 7890 189",
  bic: "BNPAFRPPXXX",
})

// Mise à jour de la clé logo uniquement (null pour retrait)
const withLogo = await setBusinessProfileLogoKey(ownerId, "business-profiles/uuid/logo")
const noLogo   = await setBusinessProfileLogoKey(ownerId, null)
// Retourne null si aucun profil n'existe pour cet ownerId (ne crée pas de profil)
```

Types importables depuis `@saas/db` :

```ts
import { type BusinessProfile, type NewBusinessProfile } from "@saas/db"
```

## Architecture interne

- **Table** : `business_profiles` dans `packages/db/src/schema.ts`. Champ `address` en `jsonb` typé `BusinessProfileAddress` (type structurel local, aligné sur `PostalAddress` de `billing-party.shared` sans créer de dépendance circulaire `db → services`).
- **Service** : `packages/services/src/business-profile.service.ts` — exposé via le barrel `packages/services/src/index.ts`. Méthodes : `getBusinessProfile`, `upsertBusinessProfile`, `setBusinessProfileLogoKey`.
- **Upsert** : `onConflictDoUpdate` sur l'index unique `business_profiles_owner_unique` (`ownerId`). Garantit l'atomicité création/mise à jour sans race condition.
- **Consommation PDF** : `getBusinessProfile` → champs → `EmitterInput` → `resolveEmitter` (R10-1f). `resolveEmitter` reste source-agnostique : il ne connaît pas cette table.
- **Push DB** : `drizzle-kit push` (pas de migration sqlx) — à exécuter côté hôte après livraison container.

## Seed e2e

Le script seed (`packages/db/src/seed.ts`) insère un `business_profile` pour l'admin (`admin@saas.dev`) :
- **name** : "Super Admin Consulting", **legalForm** : SASU, **siret** : 12345678900010
- **address** : 12 rue de la Paix, Paris 75001 FR
- `logoKey`, `iban`, `bic` : null (optionnels / upload séparé)

Ce profil est requis pour débloquer le gate `transitionInvoiceStatusAction` (transition `draft→sent`) en e2e.
Insert idempotent via `onConflictDoUpdate` sur `business_profiles_owner_unique`.

## Page d'administration

Route : `/admin/settings/business-profile`

Accessible depuis la barre latérale admin via le lien **"Profil entreprise"** (icône `Landmark`, groupe "Administration" dans `AdminSidebar`).

### Server Component — page.tsx

`apps/web/app/(admin)/admin/settings/business-profile/page.tsx`

- Protégée par `requireAdmin()` (redirect si non admin).
- Charge `getBusinessProfile(user.id)` — `null` si jamais configuré.
- Rend `<BusinessProfileLogo hasLogo={profile?.logoKey != null} version={profile?.updatedAt?.toISOString() ?? ""} />` (au-dessus du formulaire).
- Rend `<BusinessProfileForm initialProfile={profile} />`.

### BusinessProfileLogo

`apps/web/app/(admin)/admin/settings/business-profile/_components/BusinessProfileLogo.tsx`

Client Component (`"use client"`) gérant l'affichage, l'upload et le retrait du logo émetteur.

Props :

| Prop | Type | Description |
|---|---|---|
| `hasLogo` | `boolean` | `true` si `profile.logoKey != null` |
| `version` | `string` | `profile.updatedAt.toISOString()` — cache-bust pour `?v=` |

Comportement :
- **Preview** : `<img src="/api/admin/business-profile/logo?v={version}" />` (affiché si `hasLogo`). Sinon texte "Aucun logo".
- **Flux upload (deux temps)** :
  1. Le bouton "Téléverser le logo" (`data-testid="logo-upload-button"`) appelle `fileInputRef.current?.click()` — ouvre le sélecteur de fichier natif. Ne déclenche pas l'upload directement.
  2. L'`input type="file"` masqué (`data-testid="logo-file-input"`) déclenche la validation puis l'upload via son `onChange`. Après upload, `event.target.value = ""` est réinitialisé pour permettre la re-sélection du même fichier.
- **Validation client avant upload** : type ∈ `{image/png, image/jpeg}` et taille ≤ 2 MB → message d'erreur inline si invalide, pas de requête serveur.
- **Upload** : `FormData.append("logo", file)` → `uploadBusinessProfileLogoAction(fd)` → toast → `router.refresh()`.
- **Retrait** : `removeBusinessProfileLogoAction()` → toast → `router.refresh()` (bouton visible seulement si `hasLogo`).
- **État pending** : `useState<boolean>` + try/finally (pas `useTransition` — `toast` est un callback). Boutons disabled pendant `isPending`.
- Icônes : `Upload` et `Trash2` (lucide-react).

### Route preview logo

`apps/web/app/api/admin/business-profile/logo/route.ts`

`GET /api/admin/business-profile/logo` — sert le logo brut depuis R2. Protégée par `requireAdmin`.

| Condition | Réponse |
|---|---|
| Profil absent ou `logoKey` null | 404 |
| Clé R2 introuvable (`R2NotFoundError`) | 404 |
| Erreur R2 inattendue | 500 (loggée) |
| Succès | 200 + `Content-Type` + `Cache-Control: no-store` |

Le cache-bust côté UI (`?v=updatedAt`) permet de rafraîchir la preview après chaque upload sans invalider le cache CDN (header `no-store` intentionnel — le logo change rarement).

### BusinessProfileForm

`apps/web/app/(admin)/admin/settings/business-profile/_components/BusinessProfileForm.tsx`

Client Component. Pattern identique aux autres formulaires admin (`react-hook-form` + `zodResolver`).

Champs exposés par groupe :

| Groupe | Champs |
|---|---|
| Identité | `name` (requis), `legalForm`, `siret`, `tvaIntra` |
| Adresse | `address.line1`, `address.line2`, `address.zip`, `address.city`, `address.state`, `address.country` |
| Coordonnées | `email`, `phone` |
| Bancaire | `iban`, `bic` |

Comportement submit :
- Appelle `upsertBusinessProfileAction(values)`.
- Affiche un toast via `toastResult(result, { success: "Profil entreprise enregistré" })`.
- Pas de redirect : `revalidatePath` côté action rafraîchit la page en place.

`defaultValues` : `initialProfile` si non null (adresse : sous-objet vide si `null`) ; sinon tous les champs à `""`.

### Validation manuelle requise

`human_validation_checklist` (formulaire) :
1. Éditer les champs → Sauvegarder → vérifier le toast "Profil entreprise enregistré".
2. Recharger la page → vérifier que les valeurs sont persistées.
3. Laisser `name` vide → soumettre → vérifier l'erreur de validation inline.

`human_validation_checklist` (logo) :
1. Uploader un PNG ou JPEG ≤ 2 MB → vérifier le toast "Logo enregistré" et la preview visible.
2. Retirer le logo → vérifier le toast "Logo retiré" et la preview disparue ("Aucun logo").
3. Tenter d'uploader un fichier hors format ou > 2 MB → vérifier l'erreur inline (pas de requête serveur).

## Schema Zod et Server Action (Web)

### Schema de formulaire

`apps/web/lib/schemas/business-profile.schemas.ts` expose `businessProfileSchema` et le type dérivé `BusinessProfileFormValues`.

Validation intentionnellement légère : seul `name` est requis. Les champs `siret`, `email`, `iban`, `bic` et `tvaIntra` sont validés uniquement s'ils sont non vides (`.optional().or(z.literal(""))`) — compatible freelance en franchise TVA. `logoKey` est hors scope (upload séparé, R10-1e-c).

```ts
import {
  businessProfileSchema,
  type BusinessProfileFormValues,
} from "@/lib/schemas/business-profile.schemas"
```

### Server Actions

`apps/web/app/actions/business-profile.ts` expose trois actions :

#### `upsertBusinessProfileAction`

```ts
import { upsertBusinessProfileAction } from "@/app/actions/business-profile"

const result = await upsertBusinessProfileAction(formValues)
```

- Protégée par `withAdmin` — seul l'admin authentifié peut upsert son propre profil (`user.id` transmis comme `ownerId`).
- Parse le payload via `businessProfileSchema` (ZodError → exception propagée à `withAdmin`).
- Normalise les chaînes vides → `undefined` avant de déléguer à `upsertBusinessProfile`.
- Invalide le cache de `/admin/settings/business-profile` via `revalidatePath`.

#### `uploadBusinessProfileLogoAction`

```ts
import { uploadBusinessProfileLogoAction } from "@/app/actions/business-profile"

const formData = new FormData()
formData.append("logo", file)
const result = await uploadBusinessProfileLogoAction(formData)
// result: ActionResult<BusinessProfile>
```

- Accepte un `FormData` avec le champ `"logo"` (File PNG ou JPEG, max 2 MB).
- Valide le format via `detectImageFormat` (magic bytes) et la taille via `assertImageSize`.
- Upload dans R2 sous la clé stable `business-profiles/<ownerId>/logo` via `uploadImageToR2`.
- Persiste la clé dans `business_profiles.logo_key` via `setBusinessProfileLogoKey`.
- **Rollback best-effort** : si `setBusinessProfileLogoKey` retourne `null` (pas de profil existant), supprime l'objet R2 et retourne `fail("BUSINESS_PROFILE_REQUIRED")`.
- Codes d'erreur : `FILE_REQUIRED` · `INVALID_IMAGE` · `FILE_TOO_LARGE` · `BUSINESS_PROFILE_REQUIRED`.

#### `removeBusinessProfileLogoAction`

```ts
import { removeBusinessProfileLogoAction } from "@/app/actions/business-profile"

const result = await removeBusinessProfileLogoAction()
// result: ActionResult<BusinessProfile | null>
```

- Idempotente : si le profil n'a pas de `logoKey`, retourne `ok(profile)` sans appel R2.
- Supprime l'objet R2 (best-effort — erreur logguée, non bloquante), puis nullifie `logo_key` via `setBusinessProfileLogoKey(userId, null)`.
- Invalide le cache de `/admin/settings/business-profile` via `revalidatePath`.

## Liens vers tests

- `packages/services/src/__tests__/business-profile.service.test.ts` — 6 tests unitaires (mock drizzle) : get null, get after upsert (address objet), create, update avec `updatedAt` postérieur + `setBusinessProfileLogoKey` (owner existant → profil mis à jour, owner inexistant → null).
- `apps/web/lib/schemas/__tests__/business-profile.schemas.test.ts` — 5 tests schema : champs valides, siret format, email vide accepté, name requis.
- `apps/web/app/actions/__tests__/business-profile.test.ts` — 13 tests action : 5 pour `upsertBusinessProfileAction` (appel `upsertBusinessProfile` avec `user.id`, normalisation vides→undefined, revalidatePath, erreur Zod propagée) + 6 pour `uploadBusinessProfileLogoAction` (PNG/JPEG valides, FILE_REQUIRED, INVALID_IMAGE, FILE_TOO_LARGE, rollback BUSINESS_PROFILE_REQUIRED) + 2 pour `removeBusinessProfileLogoAction` (avec logoKey, sans logoKey no-op).
- `apps/web/app/(admin)/admin/settings/business-profile/_components/__tests__/BusinessProfileForm.test.tsx` — 4 tests composant : render champs vides, préremplissage depuis `initialProfile`, submit → action appelée + toast succès, blocage validation (name vide).
- `apps/web/app/api/admin/business-profile/logo/__tests__/route.test.ts` — 6 tests route GET : 200 avec buffer + Content-Type correct, 404 profil absent, 404 logoKey null, 404 R2NotFoundError, 500 erreur R2 inattendue, 401 non admin.
- `apps/web/app/(admin)/admin/settings/business-profile/_components/__tests__/BusinessProfileLogo.test.tsx` — 7 tests composant : rendu sans logo, rendu avec logo (img visible + src cache-bust), upload flux réel (clic bouton → spy `fileInput.click()` + `fireEvent.change` → action appelée), validation inline taille > 2 MB, validation inline type invalide, retrait succès → refresh, bouton retrait absent si !hasLogo.
