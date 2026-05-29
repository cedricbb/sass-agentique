# Customer Invitations

## Ce que fait ce module

Gère le flow d'invitation d'un contact client au portail.
Depuis la fiche client admin, un administrateur sélectionne un contact existant (`client_contacts`) et déclenche une invitation.
L'invitation crée un token TTL 24h permettant au contact de définir son mot de passe via `/set-password?token=…`.

Ce module pose la fondation DB (R4.6a1). La logique applicative (service, email, Server Action) est en R4.6a2–b.

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

## Architecture interne

### Décisions de design

- **Table dédiée** (pas `passwordResets`) : audit trail complet (`invitedBy`, `clientId`, `contactId`), sémantique distincte, table séparée pour les métriques d'invitations non consommées.
- **Email snapshot** : l'email est copié au moment de l'invitation. Si le contact change d'email après, le token reste valide et la résolution user-existant fonctionne sur l'email original.
- **Anti-doublon applicatif** : pas de contrainte unique `(contactId, consumedAt IS NULL)` en DB — le service `createInvitation` (R4.6a2) DELETE les invitations non consommées pour le même `contactId` avant insert. Pattern identique à `forgotPassword`.
- **SET NULL sur `invitedBy`** : un admin supprimé n'invalide pas l'historique des invitations.
- **CASCADE sur `clientId`/`contactId`** : suppression client ou contact nettoie automatiquement les invitations associées.

### Interactions

```
admin → [inviteCustomerAction] → createInvitation (R4.6a2)
  → DELETE invitations non consommées pour contactId
  → INSERT customer_invitations
  → sendCustomerInvitationEmail (lien /set-password?token=…)

customer → GET /set-password?token=…  (R4.6c)
  → valider token (expiresAt > now, consumedAt IS NULL)
  → SET password + SET consumedAt
```

## Liens vers tests

`packages/db/src/__tests__/schema.test.ts` — tests unitaires couvrant :
- Nom de table `customer_invitations`
- Présence des 9 colonnes
- Exports `customerInvitations`, `CustomerInvitation`, `NewCustomerInvitation`
