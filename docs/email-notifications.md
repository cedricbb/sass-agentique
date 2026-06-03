# Email Notifications

## Ce que fait ce module

Infrastructure partagée pour l'envoi d'emails automatiques aux contacts client. Posé en R5-B.1, câblé sur le premier événement réel en B.2 (`quote.sent`). Expose :

- **`getResendClient()`** — lazy singleton `Resend` ; instancié une seule fois au premier appel, réutilisé ensuite.
- **`dispatchNotification(event, payload)`** — point d'entrée unique pour déclencher un email à partir d'un événement métier. Évalué à chaque appel : no-op si `NOTIFICATIONS_ENABLED !== "true"`.
- **`getNotifiableContacts(clientId)`** — retourne les contacts d'un client ayant un compte portail actif (`userId IS NOT NULL`).
- **`renderQuoteSentHtml(props)`** — rend le template React Email pour `quote.sent` en HTML.

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

// Déclencher une notification quote.sent (fire-and-forget depuis un service)
await dispatchNotification("quote.sent", {
  clientId: "client-uuid",
  entityId: "quote-uuid",
  tenantId: "tenant-uuid",
});

// Récupérer les destinataires éligibles
const contacts: NotifiableContact[] = await getNotifiableContacts(clientId);
// contacts[].userId est garanti non-null par la requête (filtre structurel WHERE)
```

### Variables d'environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `RESEND_API_KEY` | Oui (prod) | Clé API Resend. `getResendClient()` throw si absente. |
| `NOTIFICATIONS_ENABLED` | Non | Doit valoir exactement `"true"` pour activer l'envoi. Toute autre valeur (absent, `"false"`, `"1"`) = no-op. |
| `APP_URL` | Non | Préfixe des liens CTA dans les emails. Défaut : `http://localhost:3001`. |

> **Killswitch CI/preview** : `NOTIFICATIONS_ENABLED` est évalué à chaque appel de `dispatchNotification`, jamais mis en cache. Le défaut strict-opt-in (`!== "true"`) empêche tout envoi réel en CI ou en preview deploy.

## Architecture interne

### Singleton Resend (`getResendClient`)

```
let resendInstance: Resend | null = null

getResendClient()
  → if resendInstance return resendInstance
  → read env.RESEND_API_KEY              // throw si absent
  → resendInstance = new Resend(key)
  → return resendInstance
```

### Dispatch map (`DISPATCH_MAP`)

```ts
const DISPATCH_MAP: Record<NotificationEvent, Handler | null> = {
  "quote.sent":    handleQuoteSentNotification,  // câblé en B.2
  "invoice.sent":  null,                          // câblé en B.3
  "report.issued": null,                          // câblé en B.4
}
```

`dispatchNotification` :
1. Early-return si `NOTIFICATIONS_ENABLED !== "true"`.
2. Consulte la map. Si `null` → `console.warn` structuré + return.
3. Si handler → `try/catch` + `console.error(JSON.stringify({ event, message }))` sur erreur (pas d'objet `Error` brut).

### Handler `quote.sent` (`handleQuoteSentNotification`)

Loose coupling : le handler reçoit uniquement `{ clientId, entityId, tenantId }` et fetch lui-même le devis et le client.

```
handleQuoteSentNotification(payload)
  → fetch quote par entityId      // log warn + return si introuvable
  → fetch client par clientId     // log warn + return si introuvable
  → getNotifiableContacts(clientId) // log warn + return si vide
  → computeQuoteTtc + Intl.NumberFormat
  → renderQuoteSentHtml(props)
  → for each contact: sendNotificationEmail(...)
```

### Template `QuoteSentEmail` (`emails/QuoteSentEmail.tsx`)

Composant React Email (`@react-email/components`) : `Html > Head > Body > Container > Heading > Text > Button(href=ctaUrl) > Hr > Text`.

Props :

| Prop | Type | Description |
|------|------|-------------|
| `quoteNumber` | `string` | Numéro du devis affiché dans le sujet et le corps |
| `clientName` | `string` | Nom du client pour la salutation |
| `totalTtcFormatted` | `string` | Montant TTC pré-formaté (ex. `1 200,00 €`) |
| `ctaUrl` | `string` | URL complète vers la page devis du portail |

### Audience helper (`getNotifiableContacts`)

```sql
SELECT id, name, email, userId
FROM clientContacts
WHERE clientId = $1
  AND userId IS NOT NULL
```

### Hook dans `quote.service.ts`

`transitionQuoteStatus(id, "sent")` déclenche `dispatchNotification` en fire-and-forget post-commit :

```ts
dispatchNotification("quote.sent", { clientId, entityId: id, tenantId }).catch(() => {});
```

L'échec du dispatch n'annule pas la transition — la mise à jour du devis est déjà committée.

### Types exportés

| Type | Valeurs |
|------|---------|
| `NotificationEvent` | `"quote.sent" \| "invoice.sent" \| "report.issued"` |
| `NotificationPayload` | `{ clientId, entityId, tenantId }` |
| `NotifiableContact` | `{ id, name, email, userId }` — `userId` non-null par construction |

## Liens vers tests

| Fichier | Tests |
|---------|-------|
| `packages/services/src/__tests__/notification.service.test.ts` | Singleton Resend, dispatch no-op, contacts notifiables |
| `packages/services/src/__tests__/quote-sent-notification.test.ts` | DISPATCH_MAP câblé, hook quote.service, handler email loop |
| `packages/services/src/__tests__/quote-sent-email.test.tsx` | Rendu HTML template, présence CTA |
