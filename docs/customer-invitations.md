# Customer Invitations

## Ce que fait ce module

Gère le flow d'invitation d'un contact client au portail.
Depuis la fiche client admin, un administrateur sélectionne un contact existant (`client_contacts`) et déclenche une invitation.
L'invitation crée un token TTL 24h permettant au contact de définir son mot de passe via `/set-password?token=…`.

R4.6a1 livre la table. R4.6a2 livre la couche service + email. R4.6b livre la Server Action admin + UI fiche client (section "Accès portail"). R4.6c livrera la création user à la consommation du token.

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

Ne crée pas de user — responsabilité de R4.6c.

### `getActiveInvitationByContact`

```ts
import { getActiveInvitationByContact } from "@saas/services";

const invitation = await getActiveInvitationByContact(contactId);
```

Retourne l'invitation active du contact (non consommée et non expirée), ou `null` si aucune.

Utilisé par la page admin `/admin/clients/[id]` pour afficher le statut portail de chaque contact.

### `inviteCustomerAction` (Server Action admin)

```ts
import { inviteCustomerAction } from "@/app/actions/clients";

const result = await inviteCustomerAction(clientId, contactId);
```

Server Action Next.js. Retourne `{ ok: true, data: { expiresAt } }` ou `{ ok: false, error: { code, message } }`.

Contrôles appliqués (dans l'ordre) :
1. `requireAdmin()` — redirect vers /login si session invalide
2. `inviteCustomerSchema` — Zod UUID sur `clientId` + `contactId` ; lève `VALIDATION_ERROR`
3. Vérification anti-IDOR — `getClientContactWithUser(contactId)` suivi d'un check `contact.clientId === clientId` ; lève `INVALID_INPUT` si mismatch
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
- **UPDATE atomique (CAS) dans `consumeInvitation`** : l'UPDATE inclut `AND consumedAt IS NULL` dans le WHERE. PostgreSQL garantit l'atomicité au niveau ligne — en cas de race condition (double-clic, bot replay, retry réseau), seul le premier thread voit 1 ligne affectée, le second reçoit 0 lignes et lève `TOKEN_ALREADY_CONSUMED`. Critique avant R4.6c qui chaîne `consumeInvitation → createUser` : sans ce guard, deux users role=client seraient créés pour le même contact.

### Interactions

### Section "Accès portail" — fiche client admin

La page `/admin/clients/[id]` affiche un tableau des contacts du client avec une colonne **Statut portail** :

| Statut | Condition |
|--------|-----------|
| "À inviter" | Pas d'invitation active (`getActiveInvitationByContact` retourne `null`) |
| "Invitation en cours, expire le DD/MM/YYYY HH:MM" | Invitation active (non consommée + non expirée) |

Chaque ligne expose un bouton déclenchant `InviteCustomerDialog` :
- **"Inviter au portail"** si aucune invitation active
- **"Renvoyer l'invitation"** si invitation active

Le 3e état "Compte créé" n'est pas disponible en R4.6b (la liaison `clientContacts.userId` arrivera en R4.6c).

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

customer → GET /set-password?token=… (R4.6c)
  → consumeInvitation(token)
    → getInvitationByToken (valide token : INVALID_TOKEN / TOKEN_EXPIRED / TOKEN_ALREADY_CONSUMED)
    → UPDATE SET consumedAt = now WHERE id = ? AND consumedAt IS NULL  ← atomique
    → si 0 lignes → throw TOKEN_ALREADY_CONSUMED (race perdue)
  → créer user role=client + lier clientContact.userId (R4.6c)
```

### Fichiers

| Fichier | Rôle |
|---|---|
| `packages/services/src/invitation.service.ts` | `createInvitation`, `getInvitationByToken`, `consumeInvitation`, `getActiveInvitationByContact` |
| `packages/services/src/email.service.ts` | `sendCustomerInvitationEmail` (template email) |
| `packages/services/src/client.service.ts` | `getClientContactWithUser` (JOIN contact ↔ user pour IDOR check + email) |
| `packages/services/src/index.ts` | Exporte `invitation.service`, `client.service` |
| `packages/db/src/schema.ts` | Table `customerInvitations` + types |
| `apps/web/app/actions/clients.ts` | `inviteCustomerAction` (Server Action admin) |
| `apps/web/lib/schemas/client.schemas.ts` | `inviteCustomerSchema` (Zod UUID clientId + contactId) |
| `apps/web/app/(admin)/admin/clients/[id]/page.tsx` | Section "Accès portail" + tableau contacts + statut portail |
| `apps/web/app/(admin)/admin/clients/_components/InviteCustomerDialog.tsx` | Dialog confirmation invitation |

## Liens vers tests

`packages/services/src/__tests__/invitation.service.test.ts` — tests unitaires couvrant :
- `createInvitation` : génère token, supprime invitations non consommées, insère, envoie email
- `getInvitationByToken` : happy path + INVALID_TOKEN + TOKEN_EXPIRED + TOKEN_ALREADY_CONSUMED
- `consumeInvitation` : marque consumedAt (UPDATE atomique CAS) + throw TOKEN_ALREADY_CONSUMED si déjà consommé (chemin métier) ou si race perdue (chemin CAS : UPDATE retourne 0 lignes)

`packages/db/src/__tests__/schema.test.ts` — tests DB : présence table + 9 colonnes + exports.

`apps/web/app/actions/__tests__/clients.test.ts` — tests Server Action `inviteCustomerAction` (4 cas) + `inviteCustomerSchema` (2 cas) :
- Success : contact valide → `createInvitation` appelé, retourne `{ ok: true, data: { expiresAt } }`
- IDOR : contact.clientId ≠ clientId → `fail("INVALID_INPUT")`, `createInvitation` non appelé
- Auth : session invalide → redirect rethrown
- Validation : UUID invalide → `VALIDATION_ERROR`

`apps/web/app/(admin)/admin/clients/_components/__tests__/InviteCustomerDialog.test.tsx` — tests composant (4 cas) :
- Titre "Inviter" vs "Renvoyer" selon `hasActiveInvitation`
- Confirm → `inviteCustomerAction` appelé
- Cancel → `inviteCustomerAction` non appelé
