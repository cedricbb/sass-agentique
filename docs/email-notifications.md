# Email Notifications

## Ce que fait ce module

Infrastructure partagée pour l'envoi d'emails automatiques aux contacts client. Posé en R5-B.1, il expose trois primitives réutilisées par B.2-B.4 (templates + hooks événements) :

- **`getResendClient()`** — lazy singleton `Resend` ; instancié une seule fois au premier appel, réutilisé ensuite.
- **`dispatchNotification(event, payload)`** — point d'entrée unique pour déclencher un email à partir d'un événement métier.
- **`getNotifiableContacts(clientId)`** — retourne les contacts d'un client ayant un compte portail actif (`userId IS NOT NULL`).

## Comment l'utiliser

Tout le module est exporté depuis le barrel `@saas/services`.

```ts
import {
  dispatchNotification,
  getNotifiableContacts,
  type NotificationEvent,
  type NotificationPayload,
  type NotifiableContact,
} from "@saas/services";

// Déclencher une notification (no-op en B.1, handlers câblés en B.2-B.4)
await dispatchNotification("quote.sent", {
  clientId: "client-uuid",
  entityId: "quote-uuid",
  tenantId: "tenant-uuid",
});

// Récupérer les destinataires éligibles
const contacts: NotifiableContact[] = await getNotifiableContacts(clientId);
// contacts[].userId est garanti non-null par la requête (filtre structurel WHERE)
```

### Variables d'environnement requises

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `RESEND_API_KEY` | Oui (prod) | Clé API Resend. `getResendClient()` throw si absente. |

En développement, `getResendClient()` n'est jamais appelé tant que `DISPATCH_MAP` est vide (B.1).

## Architecture interne

### Singleton Resend (`getResendClient`)

```
let resendInstance: Resend | null = null

getResendClient()
  → if resendInstance return resendInstance   // cache hit
  → read env.RESEND_API_KEY                  // throw si absent
  → resendInstance = new Resend(key)
  → return resendInstance
```

Instance unique pour la durée de vie du process Node — pas de reconnexion, pas de pool.

### Dispatch map (`DISPATCH_MAP`)

```ts
const DISPATCH_MAP: Record<NotificationEvent, Handler | null> = {
  "quote.sent":    null,  // câblé en B.2
  "invoice.sent":  null,  // câblé en B.3
  "report.issued": null,  // câblé en B.4
}
```

`dispatchNotification` consulte la map. Si `null` → log warning structuré + return (no-op). Si handler → `try/catch` inline + log structuré sur erreur. Pas d'Inngest (client présent mais pas d'endpoint serve ni de functions enregistrées en B.1 — décision inline par 4.b/c).

### Audience helper (`getNotifiableContacts`)

```sql
SELECT id, name, email, userId
FROM clientContacts
WHERE clientId = $1
  AND userId IS NOT NULL
```

Le filtre `userId IS NOT NULL` garantit structurellement qu'aucun contact sans compte portail actif ne figure dans l'audience — pas de guard ad-hoc côté handler.

### Types exportés

| Type | Valeurs |
|------|---------|
| `NotificationEvent` | `"quote.sent" \| "invoice.sent" \| "report.issued"` |
| `NotificationPayload` | `{ clientId, entityId, tenantId }` |
| `NotifiableContact` | `{ id, name, email, userId }` — `userId` non-null par construction |

## Liens vers tests

`packages/services/src/__tests__/notification.service.test.ts`

| Test | AC |
|------|----|
| `resend_singleton_returns_same_instance` | AC1 |
| `resend_singleton_throws_without_api_key` | AC2 |
| `dispatch_resolves_when_handler_is_null` | AC3 |
| `get_notifiable_contacts_filters_null_user_id` | AC4 |
| `get_notifiable_contacts_returns_empty_for_no_matches` | AC5 |
