# Admin Users

## Ce que fait Admin Users

Affiche la liste des utilisateurs dans le backoffice admin (`/admin/users`). Chaque ligne expose un menu d'actions destructives : ban, unban, reset TOTP. Chaque action déclenche une AlertDialog de confirmation avant exécution, puis affiche un toast de résultat (succès ou erreur).

## Comment l'utiliser

Le composant `UserActions` est monté par le Server Component de la page sur chaque ligne de la table. Il reçoit trois props :

```tsx
<UserActions userId={user.id} isBanned={user.isBanned} totpEnabled={user.totpEnabled} />
```

- Cliquer sur **"Actions"** ouvre un dropdown.
- Sélectionner une action (Bannir / Débannir / Reset 2FA) ouvre une AlertDialog de confirmation.
- Cliquer **Confirmer** appelle la server action correspondante et affiche un toast `toastResult`.
- En cas de succès, la liste est rafraîchie via `router.refresh()`.

## Architecture interne

### Composants

| Composant | Chemin | Rôle |
|---|---|---|
| `UserActions` | `apps/web/components/admin/UserActions.tsx` | Client component — dropdown + AlertDialog + toast |

### Flux de confirmation

`ConfirmAction` (`"ban" | "unban" | "resetTotp" | null`) pilote l'ouverture de l'AlertDialog. Le dictionnaire `confirmMessages` fournit le titre et la description par action ; `successMessages` fournit le libellé du toast de succès.

`handleConfirm` exécute la server action dans un `useTransition` (le bouton Confirmer est désactivé pendant l'exécution). `toastResult(result, successMessage)` affiche le toast et retourne `true` uniquement en cas de succès — `router.refresh()` n'est déclenché que dans ce cas.

### Server Actions

| Action | Fichier | Rôle |
|---|---|---|
| `banUserAction(userId)` | `apps/web/app/actions/admin.ts` | Banne l'utilisateur (retourne `ActionResult<void>`) |
| `unbanUserAction(userId)` | `apps/web/app/actions/admin.ts` | Déban l'utilisateur (retourne `ActionResult<void>`) |
| `resetUserTotpAction(userId)` | `apps/web/app/actions/admin.ts` | Supprime le secret TOTP et les backup codes |

Les trois actions sont wrappées via `withAdmin()` qui vérifie la session admin avant exécution.

### Composants shadcn utilisés

- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger` — `components/ui/dropdown-menu.tsx`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` — `components/ui/alert-dialog.tsx`
- `Button` — `components/ui/button.tsx`
- `toastResult` — `apps/web/lib/toast.ts` (helper partagé, même pattern que `ArchivePrestationButton`)

## Liens vers tests

- `apps/web/components/admin/__tests__/UserActions.test.tsx` — 4 tests : ban confirme + toast succès, unban confirme + toast succès, erreur action + toast erreur sans refresh, reset TOTP confirme + toast succès
- `apps/web/app/actions/__tests__/admin.test.ts` — 3 tests : `banUserAction` retourne `ActionResult` ok, retourne `ActionResult` erreur, `unbanUserAction` retourne `ActionResult` ok
