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

## Liens vers tests

- `packages/services/src/__tests__/business-profile.service.test.ts` — 4 tests unitaires (mock drizzle) : get null, get after upsert (address objet), create, update avec `updatedAt` postérieur.
