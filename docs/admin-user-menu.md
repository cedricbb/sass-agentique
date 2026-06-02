# Admin User Menu

## Ce que fait Admin User Menu

Affiche un dropdown utilisateur dans le header du backoffice admin : avatar avec initiales, email de l'utilisateur connecté, et un item "Déconnexion" qui détruit la session côté serveur et redirige vers `/login`.

## Comment l'utiliser

Le composant est monté automatiquement dans le layout admin (`apps/web/app/(admin)/layout.tsx`). Aucune configuration manuelle requise — le `user` est fourni par le `requireAdmin()` du layout.

```tsx
<AdminUserMenuDropdown user={{ name: user.name, email: user.email }} />
```

Cliquer sur l'avatar ouvre le dropdown. Cliquer sur "Déconnexion" soumet le `logoutAction` et redirige vers `/login`.

## Architecture interne

### Composants

| Composant | Chemin | Rôle |
|---|---|---|
| `AdminUserMenuDropdown` | `apps/web/components/admin/AdminUserMenuDropdown.tsx` | Client component — avatar + dropdown shadcn |
| `LogoutButton` | `apps/web/components/auth/LogoutButton.tsx` | Composant partagé auth — déclenche `logoutAction` |

### Logique initiales (`getAdminInitials`)

- `user.name` avec 2+ mots → initiales des 2 premiers mots en majuscules (ex: "Cédric Bb" → "CB")
- `user.name` avec 1 mot → première lettre en majuscule (ex: "Jean" → "J")
- `user.name` null ou vide → première lettre de l'email en majuscule (ex: "admin@saas.dev" → "A")

### Server Action logout

`logoutAction` dans `apps/web/app/actions/auth.ts` : détruit le cookie de session (`session-token` httpOnly) côté serveur et effectue un `redirect("/login")`. CSRF-safe par défaut (Next.js Server Actions).

### Composants shadcn utilisés

- `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger` — `components/ui/dropdown-menu.tsx`
- `Avatar`, `AvatarFallback` — `components/ui/avatar.tsx`

## Liens vers tests

- `apps/web/components/admin/__tests__/AdminUserMenuDropdown.test.tsx` — 4 tests unitaires : initiales 2 mots, initiales 1 mot, initiales sans name, rendu email + LogoutButton dans le dropdown
