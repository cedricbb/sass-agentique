# Customer Invitations

## Ce que fait ce module

Gère le flow d'invitation d'un contact client au portail.
Depuis la fiche client admin, un administrateur sélectionne un contact existant (`client_contacts`) et déclenche une invitation.
L'invitation crée un token TTL 24h permettant au contact de définir son mot de passe via `/set-password?token=…`.

R4.6a1 livre la table. R4.6a2 livre la couche service + email. R4.6b livrera la Server Action admin. R4.6c livrera la création user à la consommation du token.

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

Marque `consumedAt = now`. Délègue la validation à `getInvitationByToken` (throw si invalide/expiré/déjà consommé). Ne crée pas de user — responsabilité de R4.6c.

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

### Interactions

```
admin → [inviteCustomerAction R4.6b] → createInvitation
  → DELETE invitations non consommées pour contactId
  → INSERT customer_invitations (TTL 24h)
  → sendCustomerInvitationEmail → /set-password?token=…

customer → GET /set-password?token=… (R4.6c)
  → consumeInvitation(token)
    → getInvitationByToken (valide token)
    → SET consumedAt = now
  → créer user role=client + lier clientContact.userId (R4.6c)
```

### Fichiers

| Fichier | Rôle |
|---|---|
| `packages/services/src/invitation.service.ts` | `createInvitation`, `getInvitationByToken`, `consumeInvitation` |
| `packages/services/src/email.service.ts` | `sendCustomerInvitationEmail` (nouveau template) |
| `packages/services/src/index.ts` | Exporte `invitation.service` |
| `packages/db/src/schema.ts` | Table `customerInvitations` + types |

## Liens vers tests

`packages/services/src/__tests__/invitation.service.test.ts` — tests unitaires couvrant :
- `createInvitation` : génère token, supprime invitations non consommées, insère, envoie email
- `getInvitationByToken` : happy path + INVALID_TOKEN + TOKEN_EXPIRED + TOKEN_ALREADY_CONSUMED
- `consumeInvitation` : marque consumedAt + throw si déjà consommé

`packages/db/src/__tests__/schema.test.ts` — tests DB : présence table + 9 colonnes + exports.
