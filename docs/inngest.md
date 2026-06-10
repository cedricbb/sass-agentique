# Inngest

## Ce que fait ce module

Inngest est le moteur de workflows asynchrones du projet. Il gère l'exécution fiable et rejouable des handlers métier déclenchés par des events (Stripe webhooks, etc.) avec retry automatique, observabilité native, et isolation de la logique asynchrone hors des routes HTTP.

Le module câble trois éléments : le client singleton (source de vérité pour `inngest.send()`), le serve handler Next.js (manifest + dispatch), et le registre des fonctions handlers.

## Comment l'utiliser

**Envoyer un event depuis une route API :**

```typescript
import { inngest } from "@saas/workflows";

await inngest.send({
  name: "stripe/payment_intent.succeeded",
  data: { eventId: "evt_xxx", payload: stripeEvent },
});
```

**Enregistrer une nouvelle fonction handler (B.1/B.2+) :**

```typescript
// apps/web/inngest/functions/payment-intent-succeeded.ts
import { inngest } from "@saas/workflows";

export const paymentIntentSucceededHandler = inngest.createFunction(
  { id: "payment-intent-succeeded" },
  { event: "stripe/payment_intent.succeeded" },
  async ({ event }) => {
    // handler métier
  },
);
```

```typescript
// apps/web/inngest/functions/index.ts — ajouter au registre
import { paymentIntentSucceededHandler } from "./payment-intent-succeeded";
import { paymentIntentFailedHandler } from "./payment-intent-failed";

export const inngestFunctions = [
  paymentIntentSucceededHandler,
  paymentIntentFailedHandler,
] as const;
```

**Vérifier l'endpoint (health check) :**

```bash
curl http://localhost:3000/api/inngest
# → 200, manifest JSON listant les fonctions enregistrées
```

## Architecture interne

**Client singleton** (`packages/workflows/src/index.ts`) :

```typescript
import { Inngest } from "inngest";
export const inngest = new Inngest({ id: "saas-agentique" });
```

Exposé via `@saas/workflows`. Toutes les parties de l'app qui envoient des events importent depuis ce package — jamais d'instance locale.

**Serve handler** (`apps/web/app/api/inngest/route.ts`) :

```typescript
import { serve } from "inngest/next";
import { inngest } from "@saas/workflows";
import { inngestFunctions } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...inngestFunctions],
});
```

Expose trois verbes HTTP nécessaires au protocole Inngest : `GET` pour le manifest, `POST`/`PUT` pour le dispatch des fonctions.

**Registre des fonctions** (`apps/web/inngest/functions/index.ts`) :

Peuplé en B.1 avec `paymentIntentSucceededHandler`, étendu en B.2 avec `paymentIntentFailedHandler`, étendu en R7 A.1 avec `stripeEventsRetentionCron`. Un serve handler sans fonctions est valide — Inngest retourne un manifest vide et répond 200.

**Variables d'environnement :**

| Variable | Rôle | Requis |
|---|---|---|
| `INNGEST_EVENT_KEY` | Authentification `inngest.send()` en production | Production uniquement |
| `INNGEST_SIGNING_KEY` | Vérification de signature du serve handler | Production uniquement |

En mode dev contre le Dev Server local (`inngest dev`), les deux variables sont optionnelles — Inngest fonctionne sans authentification.

**Flow Stripe webhook (A.4 + B.1/B.2) :**

```
POST /api/stripe/webhooks
  → verifyWebhookSignature()  [garantit que l'event vient de notre compte Stripe]
  → recordStripeEvent()       [idempotence — stripe-webhook-idempotence.md]
      ┌─ inserted=true  → inngest.send("stripe/payment-intent.succeeded", { event })
      │                   inngest.send("stripe/payment-intent.failed",    { event })
      └─ inserted=false → 200 already_processed (pas de dispatch)
  → Inngest dispatch → paymentIntentSucceededHandler
      └─ step "handle-payment-intent-succeeded"
             → handlePaymentIntentSucceeded(event, deps)
                  ├─ getInvoiceById / createPayment / markStripeEventProcessed
                  └─ → PaymentIntentResult sérialisable
  → Inngest dispatch → paymentIntentFailedHandler
      ├─ console.error(JSON.stringify({ event, outcome, eventId, ... }))  [log structuré]
      ├─ (si invoiceId présent) dispatchNotification("payment.failed", { invoiceId, ownerId })  [try/catch dédié]
      └─ markStripeEventProcessed(eventId)  [non-bloquant, erreur loggée]
```

**Handler `paymentIntentSucceededHandler`** (pattern pure fn + thin wrapper) :

La logique métier est extraite dans une fonction pure (calque pattern A.4 webhook-handler) :

```
apps/web/inngest/functions/payment-intent-succeeded.handler.ts  ← logique métier pure
apps/web/inngest/functions/payment-intent-succeeded.ts          ← thin wrapper Inngest
```

Le wrapper délègue en un seul step :

```typescript
step.run("handle-payment-intent-succeeded", () =>
  handlePaymentIntentSucceeded(event, {
    getInvoiceById,
    createPayment: paymentService.createPayment,
    markStripeEventProcessed,
  }),
)
```

**Types exportés** (`payment-intent-succeeded.handler.ts`) :

```typescript
type PaymentIntentSucceededDeps = {
  getInvoiceById: (id: string) => Promise<{ id: string; ownerId: string } | null>;
  createPayment: (input: NewPaymentInput) => Promise<{ payment: unknown; invoiceMarkedAsPaid: boolean }>;
  markStripeEventProcessed: (eventId: string) => Promise<unknown>;
};

type PaymentIntentResult =
  | { status: "skipped"; reason: "no_invoice_id_metadata" | "invalid_amount" | "invoice_not_found" }
  | { status: "processed"; invoiceId: string; paymentIntentId: string; invoiceMarkedAsPaid: boolean };
```

| Paramètre `createPayment` | Valeur |
|---|---|
| `invoiceId` | `paymentIntent.metadata.invoiceId` |
| `ownerId` | `invoice.ownerId` (résolu via DB) |
| `amountCents` | `paymentIntent.amount` (cents TTC Stripe) |
| `method` | `"stripe_card"` |
| `externalRef` | `paymentIntent.id` |
| `paidAt` | `new Date(paymentIntent.created * 1000)` |

Chemins de sortie :

| Cas | Retour | Effet |
|---|---|---|
| `metadata.invoiceId` absent | `{ status: "skipped", reason: "no_invoice_id_metadata" }` | `markStripeEventProcessed` |
| `amount` <= 0 | `{ status: "skipped", reason: "invalid_amount" }` | `markStripeEventProcessed` |
| Invoice introuvable | `{ status: "skipped", reason: "invoice_not_found" }` | log structuré + `markStripeEventProcessed` |
| Happy path | `{ status: "processed", invoiceId, paymentIntentId, invoiceMarkedAsPaid }` | insert payment + mark processed |
| `createPayment` throws | propagation → Inngest retry (max 3) | — |
| `markStripeEventProcessed` throws | log structuré (non-bloquant) | — |

**Idempotence** — 3 niveaux de défense :

1. `recordStripeEvent` (unique constraint DB) : bloque les retries webhook Stripe avant dispatch.
2. `recordStripeEvent` retourne `inserted: false` → 200, pas de `inngest.send`.
3. `step.run("handle-payment-intent-succeeded", ...)` : Inngest mémorise le résultat du step par ID — un retry rejoue sans re-exécuter le step.

**Contrat sécurité** : le handler fait confiance au payload car `verifyWebhookSignature` (A.2) a validé que l'event provient de notre compte Stripe. Un acteur tiers ne peut pas forger une signature valide avec notre `STRIPE_WEBHOOK_SECRET`. `metadata.invoiceId` est donc traité comme fiable dans ce contexte.

**Cron `stripeEventsRetentionCron`** (`apps/web/inngest/functions/stripe-events-retention.ts`) :

Déclenché quotidiennement à 03:00 UTC (04:00/05:00 Europe/Paris). Purge les lignes `stripe_events` dont `createdAt < NOW() - 90 jours` afin de respecter la politique de rétention RGPD sur `payloadJson` (PII Stripe).

| Paramètre | Valeur |
|---|---|
| Schedule cron | `0 3 * * *` |
| Rétention | `STRIPE_EVENTS_RETENTION_DAYS = 90` (constante exportée depuis `@saas/services`) |
| Retour | `{ status: "completed", deletedCount: number }` |

La constante `STRIPE_EVENTS_RETENTION_DAYS` est exportée depuis `packages/services/src/stripe-event.service.ts` comme source de vérité unique — ni l'appel cron ni les tests ne hardcodent `90`.

**Handler `paymentIntentFailedHandler`** (`apps/web/inngest/functions/payment-intent-failed.ts`) :

Déclenché par `stripe/payment-intent.failed`. Rôle v2 : log structuré + notification email admin sur échec de paiement.

| Paramètre loggé | Valeur |
|---|---|
| `eventId` | `stripeEvent.id` |
| `paymentIntentId` | `paymentIntent.id` |
| `invoiceId` | `paymentIntent.metadata?.invoiceId ?? null` |
| `amount` | `paymentIntent.amount` (cents TTC) |
| `errorCode` | `paymentIntent.last_payment_error?.code ?? null` |
| `declineCode` | `paymentIntent.last_payment_error?.decline_code ?? null` |
| `errorMessage` | `paymentIntent.last_payment_error?.message ?? null` |

Séquence v2 (R7 F.3) :

```
1. Log structuré (console.error JSON)
2. Si metadata.invoiceId présent :
     getInvoiceById(invoiceId)
     → si invoice trouvée : dispatchNotification("payment.failed", { invoiceId, ownerId: invoice.ownerId })
     → try/catch dédié : l'échec de la notif est loggé mais ne bloque pas l'étape suivante
3. markStripeEventProcessed(eventId)  [try/catch dédié, non-bloquant]
```

Chemins de sortie :

| Cas | Retour | Effet |
|---|---|---|
| `metadata.invoiceId` absent | `{ status: "logged", eventId }` | log structuré + markStripeEventProcessed |
| Invoice introuvable | `{ status: "logged", eventId }` | log structuré (notif skippée) + markStripeEventProcessed |
| Happy path (invoice trouvée) | `{ status: "logged", eventId }` | log + email admin + markStripeEventProcessed |
| `dispatchNotification` throws | `{ status: "logged", eventId }` | log erreur notif (non-bloquant) + markStripeEventProcessed |
| `markStripeEventProcessed` throws | `{ status: "logged", eventId }` | log structuré erreur (non-bloquant, pas de propagation) |

Arbitrages actés (R7 F.3) :
- **Destinataire email** : admin uniquement (`ownerId` de l'invoice). Le client reçoit déjà une notification Stripe directe sur sa carte refusée.
- **Statut invoice** : NON transitionné à `overdue`. PI failed = paiement individuel raté (carte refusée) ; `overdue` = due date dépassée sans paiement. Sémantiques distinctes. Un cron dédié gérera `overdue` (sujet R8 potentiel).
- **Pure fn extraction** : NON appliqué (inline, cohérent avec effort S et trivialité v1). Si la complexité dépasse 25 lignes métier → micro-fix f2b en sprint ultérieur.

## Liens vers tests

- `apps/web/inngest/functions/__tests__/inngest-route.test.ts` — exports serve handler (GET/POST/PUT), registre (3 fonctions), manifest 200
- `apps/web/inngest/functions/__tests__/payment-intent-succeeded.test.ts` — tests wrapper Inngest : happy path, skip no_invoice_id, skip invoice_not_found, propagation erreurs
- `apps/web/inngest/functions/__tests__/payment-intent-succeeded.handler.test.ts` — tests directs de la pure fn (8 cas) : sans mock Inngest SDK, deps injectées explicitement
- `apps/web/inngest/functions/__tests__/payment-intent-failed.test.ts` — log structuré happy path, erreur markStripeEventProcessed non-bloquante, skip notif si invoiceId absent, notif non-bloquante sur throw dispatchNotification
- `apps/web/inngest/functions/__tests__/stripe-events-retention.test.ts` — schedule cron `0 3 * * *`, deletedCount loggé, appel `deleteStaleStripeEvents` avec `STRIPE_EVENTS_RETENTION_DAYS`
- `packages/services/src/__tests__/stripe-event.service.test.ts` — couverture `deleteStaleStripeEvents` (purge rows, rows récentes préservées, 0 lignes, constante exportée)
