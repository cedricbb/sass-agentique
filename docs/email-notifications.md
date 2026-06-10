# Email Notifications

## Ce que fait ce module

Infrastructure partagée pour l'envoi d'emails automatiques aux contacts client. Posé en R5-B.1, câblé sur le premier événement réel en B.2 (`quote.sent`). Expose :

- **`getResendClient()`** — lazy singleton `Resend` ; instancié une seule fois au premier appel, réutilisé ensuite.
- **`dispatchNotification(event, payload)`** — point d'entrée unique pour déclencher un email à partir d'un événement métier. Évalué à chaque appel : no-op si `NOTIFICATIONS_ENABLED` est `false`.
- **`getNotifiableContacts(clientId)`** — retourne les contacts d'un client ayant un compte portail actif (`userId IS NOT NULL`).
- **`renderQuoteSentHtml(props)`** — rend le template React Email pour `quote.sent` en HTML.
- **`renderInvoiceSentHtml(props)`** — rend le template React Email pour `invoice.sent` en HTML.
- **`renderReportIssuedHtml(props)`** — rend le template React Email pour `report.issued` en HTML.

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
| `NOTIFICATIONS_ENABLED` | Non | `"true"` ou `"false"`. Validé par `@saas/config` (Zod) : seules ces deux valeurs sont acceptées (typo = erreur au démarrage). Défaut : `false` (opt-in strict). |
| `APP_URL` | Non | Préfixe des liens CTA dans les emails. Défaut : `http://localhost:3001`. |

> **Killswitch CI/preview** : `NOTIFICATIONS_ENABLED` est évalué à chaque appel de `dispatchNotification`, jamais mis en cache. Le défaut strict-opt-in (`false`) empêche tout envoi réel en CI ou en preview deploy. La valeur est exposée comme `boolean` typé via `@saas/config` — un typo (`"tru"`, `"1"`, etc.) lève une erreur Zod au démarrage plutôt que de passer silencieusement.

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
  "quote.sent":    handleQuoteSentNotification,    // câblé en B.2
  "invoice.sent":  handleInvoiceSentNotification,  // câblé en B.3
  "report.issued": handleReportIssuedNotification, // câblé en B.4
}
```

`dispatchNotification` :
1. Early-return si `!config.NOTIFICATIONS_ENABLED` (boolean `false` via `@saas/config`).
2. Consulte la map. Si `null` → `console.warn` structuré + return.
3. Si handler → `try/catch` + `console.error(JSON.stringify({ event, message }))` sur erreur (pas d'objet `Error` brut).

### Handler `quote.sent` (`handleQuoteSentNotification`)

Loose coupling : le handler reçoit uniquement `{ clientId, entityId, tenantId }` et fetch lui-même le devis et le client.

```
handleQuoteSentNotification(payload)
  → fetch quote par entityId        // log warn + return si introuvable
  → fetch client par clientId       // log warn + return si introuvable
  → getNotifiableContacts(clientId) // log warn + return si vide
  → computeQuoteTtc + Intl.NumberFormat
  → renderQuoteSentHtml(props)
  → for each contact: sendNotificationEmail(...)
```

### Handler `invoice.sent` (`handleInvoiceSentNotification`)

Même pattern que `quote.sent`. Utilise `computeInvoiceTtc(invoice)` pour le montant TTC (jamais `invoice.totalEurCents` brut qui est HT).

```
handleInvoiceSentNotification(payload)
  → fetch invoice par entityId      // log warn + return si introuvable
  → fetch client par clientId       // log warn + return si introuvable
  → getNotifiableContacts(clientId) // log warn + return si vide
  → computeInvoiceTtc + Intl.NumberFormat
  → invoice.dueAt → dueDateFormatted (fr-FR) ou null
  → renderInvoiceSentHtml(props)
  → for each contact: sendNotificationEmail(...)
```

### Handler `report.issued` (`handleReportIssuedNotification`)

Même pattern que `quote.sent` et `invoice.sent`. Pas de transition de statut enum — l'événement est déclenché par le passage de `issuedAt` de `NULL` à `Date` dans `report.service.ts`.

```
handleReportIssuedNotification(payload)
  → fetch report par entityId         // log warn + return si introuvable
  → fetch client par clientId         // log warn + return si introuvable
  → getNotifiableContacts(clientId)   // log warn + return si vide
  → REPORT_KIND_LABELS[report.kind]   // fallback sur valeur brute si clé absente
  → issuedAt → issuedAtFormatted (fr-FR)
  → renderReportIssuedHtml(props)
  → for each contact: sendNotificationEmail(...)
```

### Labels de type rapport (`REPORT_KIND_LABELS`)

Map locale au module `notification.service.ts` (pas d'import depuis `apps/web`) :

```ts
const REPORT_KIND_LABELS: Record<string, string> = {
  delivery: "Livraison",
  monthly:  "Mensuel",
  audit:    "Audit",
  other:    "Autre",
}
```

Fallback : si le `kind` n'est pas dans la map, la valeur brute est affichée (ex : `"other"` → `"other"`). Aucun crash.

### Template `QuoteSentEmail` (`emails/QuoteSentEmail.tsx`)

Composant React Email (`@react-email/components`) : `Html > Head > Body > Container > Heading > Text > Button(href=ctaUrl) > Hr > Text`.

Props :

| Prop | Type | Description |
|------|------|-------------|
| `quoteNumber` | `string` | Numéro du devis affiché dans le sujet et le corps |
| `clientName` | `string` | Nom du client pour la salutation |
| `totalTtcFormatted` | `string` | Montant TTC pré-formaté (ex. `1 200,00 €`) |
| `ctaUrl` | `string` | URL complète vers la page devis du portail |

### Template `InvoiceSentEmail` (`emails/InvoiceSentEmail.tsx`)

Composant React Email pour `invoice.sent`.

Props :

| Prop | Type | Description |
|------|------|-------------|
| `invoiceNumber` | `string` | Numéro de facture affiché dans le sujet et le corps |
| `clientName` | `string` | Nom du client pour la salutation |
| `totalTtcFormatted` | `string` | Montant TTC pré-formaté (ex. `1 200,00 €`) |
| `dueDateFormatted` | `string \| null` | Date d'échéance formatée fr-FR, ou `null`. Rendu conditionnel : absent si `null` (pas de chaîne "null" dans le HTML). |
| `ctaUrl` | `string` | URL complète vers la page facture du portail |

### Template `ReportIssuedEmail` (`emails/ReportIssuedEmail.tsx`)

Composant React Email pour `report.issued`. Le CTA pointe vers la page détail customer (`/account/reports/{id}`) et non vers le fichier PDF (accès authentifié uniquement).

Props :

| Prop | Type | Description |
|------|------|-------------|
| `reportTitle` | `string` | Titre du rapport affiché dans le sujet et le corps |
| `kindLabel` | `string` | Label FR du type de rapport (via `REPORT_KIND_LABELS`) |
| `clientName` | `string` | Nom du client pour la salutation |
| `issuedAtFormatted` | `string` | Date d'émission formatée fr-FR |
| `ctaUrl` | `string` | URL complète vers la page détail du rapport (`/account/reports/{id}`) |

### Audience helper (`getNotifiableContacts`)

```sql
SELECT id, name, email, userId
FROM clientContacts
WHERE clientId = $1
  AND userId IS NOT NULL
```

### Hooks fire-and-forget

Chaque service déclenche `dispatchNotification` post-commit, en fire-and-forget avec `.catch` logué. L'échec du dispatch n'annule jamais la transition — la mise à jour est déjà committée.

**`quote.service.ts`** (`transitionQuoteStatus → "sent"`) :

```ts
dispatchNotification("quote.sent", { clientId, entityId: id, tenantId })
  .catch((err) => console.error(JSON.stringify({ event: "quote.sent", message: (err as Error).message })));
```

**`invoice.service.ts`** (`transitionInvoiceStatus → "sent"`) :

```ts
dispatchNotification("invoice.sent", { clientId: row.clientId, entityId: row.id, tenantId: row.ownerId })
  .catch((err) => console.error(JSON.stringify({ event: "invoice.sent", message: (err as Error).message })));
```

Le hook `invoice.sent` se déclenche uniquement sur la transition `draft → sent`. Les transitions ultérieures (`sent → paid`, etc.) n'envoient pas d'email.

**`report.service.ts`** (`markReportIssued` — `issuedAt` NULL → Date) :

```ts
dispatchNotification("report.issued", { clientId: report.clientId, entityId: report.id, tenantId: report.ownerId })
  .catch((err) => console.error(JSON.stringify({ event: "report.issued", message: (err as Error).message })));
```

Le hook est idempotent par construction : `markReportIssued` utilise une clause `WHERE issuedAt IS NULL` dans son UPDATE. Si le rapport a déjà un `issuedAt`, l'UPDATE ne retourne aucun row et le dispatch n'est pas déclenché. Un re-call ne produit donc jamais de double notification.

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
| `packages/services/src/__tests__/quote-sent-notification.test.ts` | DISPATCH_MAP câblé, hook quote.service, handler email loop, `.catch` logué |
| `packages/services/src/__tests__/quote-sent-email.test.tsx` | Rendu HTML template QuoteSentEmail, présence CTA |
| `packages/services/src/__tests__/invoice-sent-notification.test.ts` | DISPATCH_MAP invoice.sent câblé, hook invoice.service, handler TTC+dueDate, `.catch` logué |
| `packages/services/src/__tests__/invoice-sent-email.test.tsx` | Rendu HTML InvoiceSentEmail, dueDateFormatted nullable (pas de "null" littéral) |
| `packages/services/src/__tests__/report-issued-notification.test.ts` | DISPATCH_MAP report.issued câblé, hook markReportIssued idempotent, handler email loop, `.catch` logué |
| `packages/services/src/__tests__/report-issued-email.test.tsx` | Rendu HTML ReportIssuedEmail, CTA vers `/account/reports/{id}` (pas de lien PDF direct) |
