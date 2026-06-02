# Customer Invitations

## Ce que fait ce module

Gère le flow d'invitation d'un contact client au portail.
Depuis la fiche client admin, un administrateur sélectionne un contact existant (`client_contacts`) et déclenche une invitation.
L'invitation crée un token TTL 24h permettant au contact de définir son mot de passe via `/set-password?token=…`.

R4.6a1 livre la table. R4.6a2 livre la couche service + email. R4.6a2.1 fixe le TOCTOU CAS sur `consumeInvitation`. R4.6b livre la Server Action admin + UI fiche client (section "Accès portail"). R4.6c livre le flow set-password côté customer : migration `clientContacts.userId`, page `/set-password`, actions `setInitialPasswordAction`/`linkExistingAccountAction`, auto-login + redirect `/account/`. R4.6e livre le 3e état "Compte créé" sur la fiche client admin : `getLastConsumedInvitationByContact`, colonne Statut avec Tooltip user, colonne Action avec date de liaison. R4.6f1 dénormalise le nom et l'email sur `client_contacts` (colonnes `name` et `email` NOT NULL, migration 0014 avec backfill) et refactorise `addClientContact` pour accepter `{ name, email, userId? }` sans dépendre d'un user pré-existant.

## Structure de données

### Table `customer_invitations`

| Colonne | Type | Contrainte | Rôle |
|---|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` | Identifiant primaire |
| `client_id` | uuid | FK `clients.id` CASCADE | Client concerné |
| `contact_id` | uuid | FK `client_contacts.id` CASCADE | Contact spécifique invité |
| `email` | text | NOT NULL | Snapshot email au moment de l'invitation |
| `token` | text | NOT NULL, UNIQUE | Token URL `/set-password?token=…` |
| `invited_by` | uuid | FK `users.id` SET NULL, nullable | Admin déclencheur |
| `expires_at` | timestamptz | NOT NULL | `createdAt + 24h`, calculé par le service |
| `consumed_at` | timestamptz | nullable | Setté quand le password est défini |
| `created_at` | timestamptz | NOT NULL, `DEFAULT now()` | Timestamp création |

**Index** : `token` (UNIQUE), `client_id`, `contact_id`, `email`.

### Colonne `client_contacts.user_id` (R4.6c)

Migration `0013_steady_senator_kelly.sql` (Drizzle) :

| Colonne | Type | Contrainte |
|---|---|---|
| `user_id` | uuid | NULL, FK `users.id` ON DELETE SET NULL |

**Index** : `client_contacts_user_id_idx` (non-unique — un user peut être lié à plusieurs contacts dans des clients différents).

NULL acceptable : les contacts créés avant R4.6c n'ont pas encore de user lié.

### Colonnes `client_contacts.name` + `client_contacts.email` (R4.6f1)

Migration `0014_client_contacts_name_email.sql` (Drizzle, modifiée manuellement — pattern backfill-safe 3 étapes) :

| Colonne | Type | Contrainte |
|---|---|---|
| `name` | text | NOT NULL |
| `email` | text | NOT NULL |

Dénormalisation : les contacts portent désormais leur propre nom et email, indépendamment du user lié (`user_id` pouvant être NULL). Cela lève le prérequis d'un user pré-existant pour créer un contact.

**Backfill** : les rows existantes sont peuplées depuis `users` via `COALESCE(u.name, '')` et `u.email`. Les rows orphelines (`user_id IS NULL`) reçoivent `name = ''` et `email = ''` (fallback — le service `addClientContact` prévient toute nouvelle row avec des valeurs vides).

### Schema Drizzle (`packages/db/src/schema.ts`)

```ts
import { customerInvitations } from "@saas/db";
import type { CustomerInvitation, NewCustomerInvitation } from "@saas/db";
```

## Comment l'utiliser

### `createInvitation`

```ts
import { createInvitation } from "@saas/services";

const { id, token, expiresAt } = await createInvitation({
  clientId: "...",
  contactId: "...",
  email: "contact@example.com",
  invitedBy: adminUserId,
});
```

Effets :
- DELETE les invitations non consommées du même `contactId` (anti-doublon)
- INSERT une nouvelle invitation avec TTL 24h
- Envoie un email "Bienvenue dans l'espace client de `<clientName>`" avec lien `/set-password?token=…`
- L'envoi email est non bloquant : une erreur est loguée mais ne fait pas remonter l'exception

### `getInvitationByToken`

```ts
import { getInvitationByToken } from "@saas/services";

const invitation = await getInvitationByToken(token);
```

Throws :
- `INVALID_TOKEN` — token inconnu
- `TOKEN_EXPIRED` — `expiresAt < now`
- `TOKEN_ALREADY_CONSUMED` — `consumedAt` non null

### `consumeInvitation`

```ts
import { consumeInvitation } from "@saas/services";

const invitation = await consumeInvitation(token);
```

Marque `consumedAt = now` via un UPDATE atomique côté PostgreSQL (`WHERE id = ? AND consumedAt IS NULL`).

Throws :
- `INVALID_TOKEN` / `TOKEN_EXPIRED` / `TOKEN_ALREADY_CONSUMED` — délégués à `getInvitationByToken` (validation préalable)
- `TOKEN_ALREADY_CONSUMED` — si la race est perdue : l'UPDATE retourne 0 lignes car un autre thread a consommé le token entre la validation et l'UPDATE

Ne crée pas de user — la création user est effectuée par `setInitialPassword` / `linkExistingAccount` dans `auth.service.ts`.

### `setInitialPassword`

```ts
import { setInitialPassword } from "@saas/services";

const { userId, sessionToken } = await setInitialPassword({ token, password });
```

Cas : email du contact **absent** de `users`. Exécuté dans une transaction db :
1. `consumeInvitation(token)` — atomique CAS (throws si invalide/expiré/consommé)
2. Création user `role=client` avec le password hashé
3. Liaison `clientContacts.userId = newUser.id`
4. Création session (retourne `sessionToken`)

Le `sessionToken` est posé immédiatement en cookie httpOnly par `setInitialPasswordAction`.

### `linkExistingAccount`

```ts
import { linkExistingAccount } from "@saas/services";

const { userId, sessionToken } = await linkExistingAccount({ token });
```

Cas : email du contact **présent** dans `users`. Exécuté dans une transaction db :
1. `consumeInvitation(token)` — atomique CAS
2. Liaison `clientContacts.userId = existingUser.id` (password et rôle existants **non modifiés**)
3. Création session

Le user existant peut être admin et accéder au portail customer en parallèle (multi-rôle).

### `getActiveInvitationByContact`

```ts
import { getActiveInvitationByContact } from "@saas/services";

const invitation = await getActiveInvitationByContact(contactId);
```

Retourne l'invitation active du contact (non consommée et non expirée), ou `null` si aucune.

Utilisé par la page admin `/admin/clients/[id]` pour afficher le statut portail de chaque contact.

### `getLastConsumedInvitationByContact`

```ts
import { getLastConsumedInvitationByContact } from "@saas/services";

const invitation = await getLastConsumedInvitationByContact(contactId);
```

Retourne la dernière invitation consommée du contact (`consumedAt IS NOT NULL`, triée par `consumedAt DESC LIMIT 1`), ou `null` si aucune.

Utilisé par la page admin `/admin/clients/[id]` pour récupérer la date de liaison effective (`consumedAt`) à afficher dans la colonne Action quand un contact a un compte créé.

Note : appelé uniquement si `contact.userId !== null` (évite une query inutile pour les contacts sans compte).

### `setInitialPasswordAction` / `linkExistingAccountAction` (Server Actions customer)

```ts
// apps/web/app/actions/auth.ts
setInitialPasswordAction(token, password)  // form avec password
linkExistingAccountAction(token)            // form sans password
```

Les deux actions :
1. Appellent le service correspondant (`setInitialPassword` ou `linkExistingAccount`)
2. Posent le cookie `session-token` (httpOnly, secure en prod, sameSite:lax, maxAge:30j)
3. Redirigent vers `/account/`

Erreur générique : tout throw du service produit `{ ok: false, error: { code: "INVITATION_ERROR" } }` sans distinguer `INVALID_TOKEN` / `TOKEN_EXPIRED` / `TOKEN_ALREADY_CONSUMED` (non-divulgation).

### `addClientContactAction` (Server Action admin — R4.6f2)

```ts
import { addClientContactAction } from "@/app/actions/clients";

const result = await addClientContactAction(formData);
```

Server Action Next.js. Crée un contact pré-invitation depuis la fiche client admin. Retourne `{ ok: true }` ou `{ ok: false, error: code }`.

Champs FormData attendus : `clientId` (UUID), `name` (string, min 1), `email` (email valide), `role` (string, optionnel), `isPrimary` (checkbox — présent = `true`, absent = `false`).

Contrôles appliqués (dans l'ordre) :
1. `requireAdmin()` — redirect vers /login si session invalide
2. `addClientContactSchema` — Zod parse FormData ; `isPrimary` converti en boolean via `transform`
3. Anti-IDOR existence client — `getClientById(clientId)` ; lève `INVALID_INPUT` si client introuvable
4. Anti-doublon email — `listClientContacts(clientId)` ; lève `EMAIL_ALREADY_EXISTS` si email déjà présent sur ce client
5. `addClientContact({ ...parsed, userId: null })` — userId forcé à `null` (l'admin crée toujours un contact sans user lié ; la liaison vient au set-password)
6. `revalidatePath("/admin/clients/[id]")` — rafraîchit la section contacts

### `inviteCustomerAction` (Server Action admin)

```ts
import { inviteCustomerAction } from "@/app/actions/clients";

const result = await inviteCustomerAction(clientId, contactId);
```

Server Action Next.js. Retourne `{ ok: true, data: { expiresAt } }` ou `{ ok: false, error: { code, message } }`.

Contrôles appliqués (dans l'ordre) :
1. `requireAdmin()` — redirect vers /login si session invalide
2. `inviteCustomerSchema` — Zod UUID sur `clientId` + `contactId` ; lève `VALIDATION_ERROR`
3. Vérification anti-IDOR — `listClientContacts(clientId).find(c => c.id === contactId)` ; lève `INVALID_INPUT` si contact introuvable ou n'appartient pas au client
4. `createInvitation({ clientId, contactId, email, invitedBy })` — DELETE old + INSERT new + envoi email

### `sendCustomerInvitationEmail`

Fonction interne appelée par `createInvitation`. Disponible dans `email.service.ts` pour usage direct si besoin.

```ts
import { sendCustomerInvitationEmail } from "@saas/services/email.service";

await sendCustomerInvitationEmail(email, token, clientName, inviterName?);
```

URL générée : `${APP_URL}/set-password?token=${token}` (distinct de `/reset-password`).
Fallback console.log si ni `SMTP_HOST` ni `RESEND_API_KEY` n'est configuré.

## Architecture interne

### Décisions de design

- **Table dédiée** (pas `passwordResets`) : audit trail complet (`invitedBy`, `clientId`, `contactId`), sémantique distincte, métriques d'invitations non consommées.
- **Email snapshot** : l'email est copié au moment de l'invitation. Si le contact change d'email après, le token reste valide sur l'email original.
- **Anti-doublon applicatif** : DELETE invitations non consommées pour le même `contactId` avant INSERT. Pattern identique à `forgotPassword`.
- **Pas de création user à l'invitation** : évite les users fantômes. La création user interviendra en R4.6c à la consommation du token.
- **SET NULL sur `invitedBy`** : un admin supprimé n'invalide pas l'historique des invitations.
- **CASCADE sur `clientId`/`contactId`** : suppression client ou contact nettoie automatiquement les invitations associées.
- **Erreurs nommées** : `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_CONSUMED` — cohérent avec `resetPassword` dans `auth.service.ts`.
- **UPDATE atomique (CAS) dans `consumeInvitation`** : l'UPDATE inclut `AND consumedAt IS NULL` dans le WHERE. PostgreSQL garantit l'atomicité au niveau ligne — en cas de race condition (double-clic, bot replay, retry réseau), seul le premier thread voit 1 ligne affectée, le second reçoit 0 lignes et lève `TOKEN_ALREADY_CONSUMED`. Sans ce guard, deux users `role=client` seraient créés pour le même contact.
- **Transaction db dans `setInitialPassword`** : consume + createUser + linkContact + createSession s'exécutent atomiquement. En cas de crash entre étapes, la transaction est annulée. L'invitation reste consommée uniquement si toutes les étapes ont réussi.
- **Erreur générique côté client** : les trois cas `INVALID_TOKEN` / `TOKEN_EXPIRED` / `TOKEN_ALREADY_CONSUMED` produisent le même message UI "Lien invalide". Non-divulgation : un attaquant testant des tokens aléatoires ne peut pas distinguer les cas.
- **Auto-login sans passer par /login** : l'email était prouvé via le token (lien reçu sur cette adresse). La session est créée côté serveur (Server Action) et posée en cookie httpOnly. Aucun stockage localStorage/sessionStorage.
- **`clientContacts.userId` sans UNIQUE** : un même user peut être lié à plusieurs contacts dans des clients différents (freelance qui est aussi son propre client, par exemple). Décision Cédric.
- **Page `/set-password` — validation token au GET** : le Server Component valide le token au mount. Si invalide, rendu d'une page d'erreur statique avec lien vers `/portal-invitation-help`. L'utilisateur ne saisit pas de mot de passe pour rien.
- **2 forms distincts selon l'état du compte** : token valide + email absent → form avec champs password + confirm + `setInitialPasswordAction`. Token valide + email présent → form sans password, bouton "Lier mon compte" + mention explicite + `linkExistingAccountAction`.

### Interactions

### Section "Accès portail" — fiche client admin

La page `/admin/clients/[id]` affiche un bouton **"Ajouter un contact"** (R4.6f2) en en-tête de section, suivi d'un tableau des contacts du client avec une colonne **Statut portail** et une colonne **Action**.

**Bouton "Ajouter un contact"** (R4.6f2) : ouvre `AddClientContactDialog`. Visible pour tous les clients, indépendamment du nombre de contacts existants.

**Priorité de détection des états (dans l'ordre) :**

| Priorité | Condition | Statut affiché | Action affichée |
|----------|-----------|----------------|-----------------|
| 1 | `contact.userId !== null` | "Compte créé" (Tooltip au survol : email + nom du user lié) | `"Compte créé le DD/MM/YYYY"` (date = `consumedAt` de la dernière invitation consommée) ou `"Compte créé"` si aucune invitation consommée trouvée |
| 2 | Invitation active (`consumedAt IS NULL AND expiresAt > now()`) | `"Invitation en cours, expire le DD/MM/YYYY HH:MM"` | Bouton `InviteCustomerDialog` — "Renvoyer l'invitation" |
| 3 | Sinon | `"À inviter"` | Bouton `InviteCustomerDialog` — "Inviter au portail" |

**Tooltip "Compte créé" (R4.6e)** : composant shadcn `Tooltip`/`TooltipTrigger`/`TooltipContent` (`apps/web/components/ui/tooltip.tsx`). Contenu : `user.email` + ` — user.name` si `name` non null.

**Date de liaison** : provient de `customer_invitations.consumedAt` (date effective de liaison), **pas** de `users.createdAt` (peut être très antérieure si user préexistant lié via `linkExistingAccount`). Si plusieurs invitations consommées historiques existent pour ce contact, la plus récente est prise (`ORDER BY consumedAt DESC LIMIT 1`).

Pour chaque contact, le chargement est parallèle via `Promise.all` :
1. `listClientContacts(clientId)` — liste tous les contacts (R4.6f2 : remplace `getClientContactWithUser` pour supporter les contacts sans userId)
2. `getActiveInvitationByContact(contact.id)` — invitation active
3. `getLastConsumedInvitationByContact(contact.id)` — uniquement si `contact.userId !== null` (sinon `Promise.resolve(null)`)

### `AddClientContactDialog` (R4.6f2)

Composant client (`"use client"`). Ouvre un Dialog shadcn (pas AlertDialog — formulaire multi-champs) depuis la fiche client admin.

**Champs du formulaire :**
- **Nom** (input text, required, min 1)
- **Email** (input email, required, format valide)
- **Rôle** (Select shadcn avec valeurs : "Décideur", "Comptable", "Chef de projet", "Technique", "Autre")
- **Contact principal** (Checkbox shadcn, default `false`)

**Logique Select "Autre"** : quand l'utilisateur sélectionne "Autre", un second input texte "Précisez le rôle" apparaît. La valeur envoyée à la Server Action est :
- Select = valeur prédéfinie → cette valeur directement
- Select = "Autre" + input rempli → la valeur saisie
- Select = "Autre" + input vide → champ `role` absent du FormData (role = null côté serveur)
- Aucune sélection → champ `role` absent (role = null)

La logique "Autre + input" est entièrement UI-only. Le serveur reçoit uniquement une string ou rien.

Appelle `addClientContactAction(formData)` via `useTransition`. Toast shadcn en feedback (succès ou erreur). Ferme le dialog au succès.

```
admin → [AddClientContactDialog] → addClientContactAction
  → requireAdmin() + zod addClientContactSchema
  → getClientById(clientId) — anti-IDOR existence
  → listClientContacts(clientId) — anti-doublon email
  → addClientContact({ name, email, role, isPrimary, clientId, userId: null })
  → revalidatePath("/admin/clients/[id]")
  → contact apparaît avec statut "À inviter" dans le tableau

admin → [InviteCustomerDialog] → inviteCustomerAction
  → createInvitation → sendCustomerInvitationEmail
```

### `InviteCustomerDialog`

Composant client (`"use client"`). Ouvre un AlertDialog shadcn affichant :
- Titre dynamique : "Inviter \<name\> au portail client ?" ou "Renvoyer l'invitation à \<name\> ?"
- Email destinataire
- Mention "Un email sera envoyé avec un lien valable 24h"
- Boutons "Annuler" + "Envoyer l'invitation"

Appelle `inviteCustomerAction(clientId, contactId)` via `useTransition`. Toute logique métier est dans la Server Action ; le dialog est purement UI.

```
admin → [inviteCustomerAction R4.6b] → createInvitation
  → DELETE invitations non consommées pour contactId
  → INSERT customer_invitations (TTL 24h)
  → sendCustomerInvitationEmail → /set-password?token=…

customer → GET /set-password?token=…
  → Server Component : getInvitationByToken(token) au mount
    → token invalide/expiré/consommé → render page erreur "Lien invalide"
      → lien vers /portal-invitation-help (page statique)
    → token valide + email absent de users → render <PasswordSetupForm> (password + confirm)
    → token valide + email présent dans users → render <LinkAccountForm> (bouton + mention)

customer → POST (Server Action) setInitialPasswordAction(token, password)
  → setInitialPassword({ token, password }) — db.transaction :
    → consumeInvitation(token) CAS atomique
    → createUser(email, hashedPassword, role=client)
    → UPDATE client_contacts SET user_id = newUser.id
    → createSession(userId) → sessionToken
  → setCookie("session-token", sessionToken, httpOnly/secure/sameSite:lax)
  → redirect("/account/")

customer → POST (Server Action) linkExistingAccountAction(token)
  → linkExistingAccount({ token }) — db.transaction :
    → consumeInvitation(token) CAS atomique
    → UPDATE client_contacts SET user_id = existingUser.id
    → createSession(existingUser.id) → sessionToken
  → setCookie("session-token", sessionToken, httpOnly/secure/sameSite:lax)
  → redirect("/account/")
```

### Fichiers

| Fichier | Rôle |
|---|---|
| `packages/services/src/invitation.service.ts` | `createInvitation`, `getInvitationByToken`, `consumeInvitation`, `getActiveInvitationByContact`, `getLastConsumedInvitationByContact` |
| `packages/services/src/auth.service.ts` | `setInitialPassword`, `linkExistingAccount` (flow customer R4.6c) |
| `packages/services/src/email.service.ts` | `sendCustomerInvitationEmail` (template email) |
| `packages/services/src/client.service.ts` | `getClientContactWithUser`, `listClientContacts`, `addClientContact` (JOIN contact ↔ user, liste contacts par client, ajout contact) |
| `packages/services/src/index.ts` | Exporte `invitation.service`, `client.service`, `auth.service` |
| `packages/db/src/schema.ts` | Table `customerInvitations` + colonnes `clientContacts.userId`, `clientContacts.name`, `clientContacts.email` + types |
| `packages/db/migrations/0013_steady_senator_kelly.sql` | Migration DDL : `user_id` nullable + FK SET NULL + index non-unique |
| `packages/db/migrations/0014_client_contacts_name_email.sql` | Migration DDL (R4.6f1) : `name` + `email` NOT NULL avec backfill depuis `users` |
| `apps/web/app/actions/auth.ts` | `setInitialPasswordAction`, `linkExistingAccountAction` (Server Actions customer) |
| `apps/web/app/actions/clients.ts` | `inviteCustomerAction` + `addClientContactAction` (Server Actions admin) |
| `apps/web/app/(auth)/set-password/page.tsx` | Server Component : validation token + branch UI (form password / form lien) |
| `apps/web/app/(auth)/portal-invitation-help/page.tsx` | Page statique aide — "Contactez votre administrateur" |
| `apps/web/components/auth/PasswordSetupForm.tsx` | Composant partagé password + confirm (set-password + reset-password) |
| `apps/web/components/auth/ResetPasswordForm.tsx` | Wrapper `PasswordSetupForm` (refactorisé R4.6c) |
| `apps/web/middleware.ts` | `/set-password` + `/portal-invitation-help` dans `PUBLIC_ROUTES` |
| `apps/web/lib/schemas/client.schemas.ts` | `inviteCustomerSchema` (UUID clientId + contactId) + `addClientContactSchema` (R4.6f2 : name, email, role, isPrimary, clientId) |
| `apps/web/app/(admin)/admin/clients/[id]/page.tsx` | Section "Accès portail" + bouton "Ajouter un contact" + tableau contacts + statut portail |
| `apps/web/app/(admin)/admin/clients/_components/InviteCustomerDialog.tsx` | Dialog confirmation invitation |
| `apps/web/app/(admin)/admin/clients/_components/AddClientContactDialog.tsx` | Dialog formulaire ajout contact (R4.6f2) |

## Tests e2e Playwright (R4.6d)

`apps/web/tests/e2e/customer-invitation-e2e.spec.ts` — spec Playwright couvrant la chaîne complète admin invite → set-password → /account/ → vérification "Compte créé".

**Deux scénarios distincts, aucune entité partagée :**

| Scénario | Email | Client seed | Flow |
|---|---|---|---|
| A — Nouveau user | `e2e-newuser-${Date.now()}@test.dev` | `acme-studio` | Token valide + email absent de `users` → form password (`set-new`) → `/account/` |
| B — User existant | `e2e-existing-${Date.now()}@test.dev` | `bob-indep` | Création compte via `/register` → token → form "Lier mon compte existant" (`link-existing`) → `/account/` |

**Setup via UI (R4.6f2)** : les contacts sont créés via le vrai flow UI admin (helpers `addContactViaUI` + `inviteContactViaUI`) plutôt que via service layer direct. Le setup R4.6f2 :
1. Login admin → navigate vers la fiche client
2. Clic "Ajouter un contact" → remplissage du dialog → submit → attente toast succès → contact visible "À inviter"
3. Clic "Inviter au portail" → AlertDialog confirmer → toast "Invitation envoyée"
4. `getInvitationTokenForContact(email)` — interception token DB

**Interception du token** : `getInvitationTokenForContact(email)` — query DB Drizzle dans `resolve-seed-ids.ts`. Retourne le token de la dernière invitation active pour l'email donné, throw si aucune.

**Logout** : `page.context().clearCookies()` (pas de bouton logout dans le layout admin).

**Helpers e2e utilisés** (apps/web/tests/e2e/helpers/resolve-seed-ids.ts) :
- `getInvitationTokenForContact(email)` — query `customer_invitations WHERE email = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1`
- `resolveClientIdBySlug(slug)` — query `clients WHERE slug = ?`

Note : `resolveAdminId()` supprimé du helper — plus utilisé après refacto R4.6f2 (l'admin est identifié via login UI, pas via lookup DB direct).

## Liens vers tests

`packages/services/src/__tests__/invitation.service.test.ts` — tests unitaires couvrant :
- `createInvitation` : génère token, supprime invitations non consommées, insère, envoie email
- `getInvitationByToken` : happy path + INVALID_TOKEN + TOKEN_EXPIRED + TOKEN_ALREADY_CONSUMED
- `consumeInvitation` : marque consumedAt (UPDATE atomique CAS) + throw TOKEN_ALREADY_CONSUMED si déjà consommé (chemin métier) ou si race perdue (chemin CAS : UPDATE retourne 0 lignes)
- `getLastConsumedInvitationByContact` : retourne la dernière invitation consommée (DESC) + null si aucune (2 cas)

`packages/services/src/__tests__/auth.service.test.ts` — tests `setInitialPassword` + `linkExistingAccount` (8 cas) :
- `setInitialPassword` : crée user + lie contact + crée session (happy path)
- `setInitialPassword` : token valide → `sessionToken` retourné
- `setInitialPassword` : throws INVALID_TOKEN / TOKEN_EXPIRED / TOKEN_ALREADY_CONSUMED
- `setInitialPassword` : exécuté dans `db.transaction`
- `linkExistingAccount` : lie contact sans toucher password ni rôle
- `linkExistingAccount` : crée session après liaison

`packages/db/src/__tests__/schema.test.ts` — tests DB : présence table + colonnes + exports.

`apps/web/app/actions/__tests__/clients.test.ts` — tests Server Action `inviteCustomerAction` (4 cas) + `inviteCustomerSchema` (2 cas) + `addClientContactAction` (5 cas R4.6f2) :
- `inviteCustomerAction` — Success : contact valide → `createInvitation` appelé, retourne `{ ok: true, data: { expiresAt } }`
- `inviteCustomerAction` — IDOR : contact introuvable ou contact.clientId ≠ clientId → `fail("INVALID_INPUT")`, `createInvitation` non appelé
- `inviteCustomerAction` — Auth : session invalide → redirect rethrown
- `inviteCustomerAction` — Validation : UUID invalide → `VALIDATION_ERROR`
- `addClientContactAction` — Success : contact créé avec `userId: null`, retourne `{ ok: true }`
- `addClientContactAction` — Client introuvable : `INVALID_INPUT`
- `addClientContactAction` — Doublon email : `EMAIL_ALREADY_EXISTS`
- `addClientContactAction` — Non authentifié : redirect rethrown
- `addClientContactAction` — Input invalide : `VALIDATION_ERROR`

`apps/web/app/(admin)/admin/clients/_components/__tests__/InviteCustomerDialog.test.tsx` — tests composant (4 cas) :
- Titre "Inviter" vs "Renvoyer" selon `hasActiveInvitation`
- Confirm → `inviteCustomerAction` appelé
- Cancel → `inviteCustomerAction` non appelé
