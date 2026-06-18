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
  logoKey: "logos/owner-uuid/logo.png",   // null si pas encore uploadé
})
```

Types importables depuis `@saas/db` :

```ts
import { type BusinessProfile, type NewBusinessProfile } from "@saas/db"
```

## Architecture interne

- **Table** : `business_profiles` dans `packages/db/src/schema.ts`. Champ `address` en `jsonb` typé `BusinessProfileAddress` (type structurel local, aligné sur `PostalAddress` de `billing-party.shared` sans créer de dépendance circulaire `db → services`).
- **Service** : `packages/services/src/business-profile.service.ts` — exposé via le barrel `packages/services/src/index.ts`.
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
- Rend `<BusinessProfileForm initialProfile={profile} />`.

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
- Logo hors scope (R10-1e-c).

`defaultValues` : `initialProfile` si non null (adresse : sous-objet vide si `null`) ; sinon tous les champs à `""`.

### Validation manuelle requise

`human_validation_checklist` :
1. Éditer les champs → Sauvegarder → vérifier le toast "Profil entreprise enregistré".
2. Recharger la page → vérifier que les valeurs sont persistées.
3. Laisser `name` vide → soumettre → vérifier l'erreur de validation inline.

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

### Server Action

`apps/web/app/actions/business-profile.ts` expose `upsertBusinessProfileAction`.

```ts
import { upsertBusinessProfileAction } from "@/app/actions/business-profile"

const result = await upsertBusinessProfileAction(formValues)
```

- Protégée par `withAdmin` — seul l'admin authentifié peut upsert son propre profil (`user.id` transmis comme `ownerId`).
- Parse le payload via `businessProfileSchema` (ZodError → exception propagée à `withAdmin`).
- Normalise les chaînes vides → `undefined` avant de déléguer à `upsertBusinessProfile`.
- Invalide le cache de `/admin/settings/business-profile` via `revalidatePath`.

## Liens vers tests

- `packages/services/src/__tests__/business-profile.service.test.ts` — 4 tests unitaires (mock drizzle) : get null, get after upsert (address objet), create, update avec `updatedAt` postérieur.
- `apps/web/lib/schemas/__tests__/business-profile.schemas.test.ts` — 5 tests schema : champs valides, siret format, email vide accepté, name requis.
- `apps/web/app/actions/__tests__/business-profile.test.ts` — 5 tests action : appel `upsertBusinessProfile` avec `user.id`, normalisation vides→undefined, revalidatePath, erreur Zod propagée.
- `apps/web/app/(admin)/admin/settings/business-profile/_components/__tests__/BusinessProfileForm.test.tsx` — 4 tests composant : render champs vides, préremplissage depuis `initialProfile`, submit → action appelée + toast succès, blocage validation (name vide).
