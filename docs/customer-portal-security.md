# Customer Portal — Sécurité (/account/profile + layout)

## Ce que fait ce module

Expose les contrôles de sécurité du compte customer en deux points :

1. **Section "Sécurité" sur `/account/profile`** — card affichée sous "Informations personnelles" avec le statut 2FA, un bouton d'action 2FA conditionnel, et le bouton "Changer le mot de passe".
2. **Bannière 2FA persistante dans `CustomerShell`** — alerte amber affichée sur toutes les pages `/account/*` quand le customer n'a pas encore activé son 2FA. Non-dismissable : disparaît uniquement quand `totpEnabled` passe à `true`.

## Comment l'utiliser

### Section Sécurité sur `/account/profile`

La card "Sécurité" apparaît automatiquement sous "Informations personnelles". Elle affiche :

- **Badge statut 2FA** : vert "Activé" si `totpEnabled=true`, amber "Non activé" si `false`.
- **Bouton 2FA conditionnel** :
  - `totpEnabled=false` → "Configurer le 2FA" → lien vers `/account/security/setup`
  - `totpEnabled=true` → "Désactiver le 2FA" → lien vers `/account/security`
- **Bouton "Changer le mot de passe"** → ouvre un Dialog avec trois champs (mot de passe actuel, nouveau, confirmation).

### Bannière 2FA

Rendue automatiquement par `CustomerShell` sans configuration. Elle s'affiche sur toutes les pages du portail customer si `totpEnabled=false` :

```
⚠ Sécurisez votre compte en activant l'authentification à deux facteurs.
  [Configurer maintenant] → /account/security/setup
```

Pas de bouton "Fermer" (MVP intentionnel). Aucun cookie/sessionStorage.

### Changement de mot de passe

Le Dialog suit le même pattern que `ChangePasswordButton` côté admin :

- `changeCustomerPasswordAction` valide `oldPassword` + `newPassword` (min 8 chars) côté serveur.
- Erreur inline sous le champ `oldPassword` si `INVALID_PASSWORD`.
- Succès : Dialog se ferme, toast "Mot de passe modifié", session courante conservée.

## Architecture interne

### Composants

| Composant | Type | Rôle |
|-----------|------|------|
| `CustomerSecuritySection` | Server Component async | Récupère `totpEnabled` via `requireCustomer()`, rend badge + liens 2FA + `<CustomerChangePasswordButton>` |
| `CustomerChangePasswordButton` | Client Component | Clone de `ChangePasswordButton` admin, wired sur `changeCustomerPasswordAction` via `useActionState` |
| `TwoFactorBanner` | Server Component | Reçoit `totpEnabled: boolean`, retourne `null` si `true`, sinon alerte amber avec CTA |

### Server Action

`changeCustomerPasswordAction` (`apps/web/app/actions/customer-profile.ts`) :
- `validateSession()` — récupère le `userId` de session
- `changePasswordSchema.parse(formData)` — validation Zod
- `changeUserPassword(userId, oldPassword, newPassword)` — délègue au service auth

### Propagation du statut 2FA

```
account/layout.tsx
  └── getUserTotpStatus(user.id)  →  totpEnabled: boolean
        └── CustomerShell(totpEnabled)
              └── TwoFactorBanner(totpEnabled)   ← bannière layout-wide
```

`CustomerSecuritySection` sur la page profile relit la session indépendamment via `requireCustomer()`.

## Liens vers tests

- `apps/web/app/(customer)/account/__tests__/layout.test.tsx` — 3 tests : bannière affichée (disabled), bannière absente (enabled), aucun bouton dismiss
- `apps/web/app/(customer)/account/profile/__tests__/page.test.tsx` — 4 tests : card sécurité (disabled/enabled), liens 2FA conditionnels
- `apps/web/components/profile/__tests__/CustomerChangePasswordButton.test.tsx` — 1 test : wiring `useActionState → changeCustomerPasswordAction`
