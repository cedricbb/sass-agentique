# Admin Profile

## Ce que fait Admin Profile

Permet à l'administrateur unique de consulter et modifier ses informations personnelles depuis `/admin/profile`. Inclut la mise à jour du profil (nom, email) et le changement de mot de passe avec vérification de l'ancien mot de passe.

## Comment l'utiliser

### Changement de mot de passe

Bouton "Modifier le mot de passe" dans la section **Sécurité** de `/admin/profile`. Ouvre un Dialog avec trois champs :

- **Mot de passe actuel** — vérifié côté serveur avant toute mise à jour
- **Nouveau mot de passe** — minimum 8 caractères
- **Confirmation** — doit correspondre au nouveau mot de passe

En cas d'erreur (`INVALID_PASSWORD`), le message "Mot de passe actuel incorrect" apparaît inline sous le champ `oldPassword`. Au succès : Dialog se ferme, form se réinitialise, toast "Mot de passe modifié". La session courante reste valide (pas de déconnexion forcée).

## Architecture interne

### UI (`ChangePasswordButton.tsx`)

Client Component (`"use client"`) calqué sur le pattern `ProfileEditButton` :

- `useActionState(changeAdminPasswordAction, null)` — state initialisé à `null` (succès)
- `useEffect` surveille `pending` + `state` : ferme le Dialog et appelle `toast.success` quand `state === null` après soumission
- `wasSubmitted` ref pour distinguer l'état initial (state=null) du succès (state=null après soumission)
- `formRef.current?.reset()` — efface les champs après succès
- Erreurs inline sous `oldPassword` via `state?.error`

Intégration dans `app/(admin)/admin/profile/page.tsx` : section "Sécurité" en bas de page, cohérente avec les sections "Informations personnelles" et "Réseaux sociaux" (même card pattern `rounded-2xl border bg-card`).

### Service (`auth.service.ts`)

```ts
changeUserPassword(userId: string, oldPassword: string, newPassword: string): Promise<void>
```

1. SELECT user par `userId` — lève `USER_NOT_FOUND` si absent
2. `bcrypt.compare(oldPassword, user.hashedPassword)` — lève `INVALID_PASSWORD` si invalide
3. `bcrypt.hash(newPassword, BCRYPT_ROUNDS)` — constante partagée `12`
4. UPDATE `users.hashedPassword`
5. Aucun effet sur les sessions existantes

### Schéma Zod (`lib/schemas/profile.schemas.ts`)

`changePasswordSchema` — valide `oldPassword` (min 1), `newPassword` (min 8), et l'égalité `newPassword === confirmNewPassword` via `.refine`.

### Server Action (`app/actions/profile.ts`)

`changeAdminPasswordAction(prevState, formData)` :

1. `requireAdmin()` — redirect si non authentifié
2. Parse `formData` via `changePasswordSchema`
3. Appelle `changeUserPassword`
4. En cas d'`INVALID_PASSWORD` : retourne `{ error: "Mot de passe actuel incorrect" }`
5. En cas de succès : retourne `null`

## Liens vers tests

- `packages/services/src/__tests__/auth.service.test.ts` — describe `changeUserPassword` (4 cas)
- `apps/web/lib/schemas/__tests__/profile.schemas.test.ts` — 3 cas `changePasswordSchema`
- `apps/web/app/actions/__tests__/profile.test.ts` — 3 cas `changeAdminPasswordAction`
- `apps/web/components/profile/__tests__/ChangePasswordButton.test.tsx` — tests UI composant
