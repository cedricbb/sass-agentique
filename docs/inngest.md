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
      ├─ step "get-invoice"    → getInvoiceById(metadata.invoiceId)
      ├─ step "create-payment" → paymentService.createPayment(...)
      └─ markStripeEventProcessed(eventId)  [non-bloquant, erreur loggée]
  → Inngest dispatch → paymentIntentFailedHandler
      ├─ console.error(JSON.stringify({ event, outcome, eventId, ... }))  [log structuré]
      └─ markStripeEventProcessed(eventId)  [non-bloquant, erreur loggée]
```

**Handler `paymentIntentSucceededHandler`** (`apps/web/inngest/functions/payment-intent-succeeded.ts`) :

| Paramètre `createPayment` | Valeur |
|---|---|
| `invoiceId` | `paymentIntent.metadata.invoiceId` |
| `ownerId` | `invoice.ownerId` (résolu via DB) |
| `amountEurCents` | `paymentIntent.amount` (cents TTC Stripe) |
| `method` | `"stripe_card"` |
| `externalRef` | `paymentIntent.id` |
| `paidAt` | `new Date(paymentIntent.created * 1000)` |

Chemins de sortie :

| Cas | Retour | Effet |
|---|---|---|
| `metadata.invoiceId` absent | `{ status: "skipped", reason: "no_invoice_id_metadata" }` | `markStripeEventProcessed` |
| Invoice introuvable | `{ status: "skipped", reason: "invoice_not_found" }` | log structuré + `markStripeEventProcessed` |
| Happy path | `{ status: "processed", invoiceId, paymentIntentId, invoiceMarkedAsPaid }` | insert payment + mark processed |
| `createPayment` throws | propagation → Inngest retry (max 3) | — |
| `markStripeEventProcessed` throws | log structuré (non-bloquant) | — |

**Idempotence** — 3 niveaux de défense :

1. `recordStripeEvent` (unique constraint DB) : bloque les retries webhook Stripe avant dispatch.
2. `recordStripeEvent` retourne `inserted: false` → 200, pas de `inngest.send`.
3. `step.run("create-payment", ...)` : Inngest mémorise le résultat du step par ID — un retry rejoue sans re-exécuter le step.

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

Déclenché par `stripe/payment-intent.failed`. Rôle v1 : observabilité uniquement (pas d'insertion `payments`, pas de notification email, pas d'update statut invoice).

| Paramètre loggé | Valeur |
|---|---|
| `eventId` | `stripeEvent.id` |
| `paymentIntentId` | `paymentIntent.id` |
| `invoiceId` | `paymentIntent.metadata?.invoiceId ?? null` |
| `amount` | `paymentIntent.amount` (cents TTC) |
| `errorCode` | `paymentIntent.last_payment_error?.code ?? null` |
| `declineCode` | `paymentIntent.last_payment_error?.decline_code ?? null` |
| `errorMessage` | `paymentIntent.last_payment_error?.message ?? null` |

Chemins de sortie :

| Cas | Retour | Effet |
|---|---|---|
| Happy path | `{ status: "logged", eventId }` | log structuré + `markStripeEventProcessed` |
| `markStripeEventProcessed` throws | `{ status: "logged", eventId }` | log structuré erreur (non-bloquant, pas de propagation) |

Décision R6 lock — non implémenté en v1 (arbitrage produit requis avant impl) :
- Email admin via `notification.service`
- Update statut invoice `overdue` via webhook (aujourd'hui géré par cron overdue)

## Liens vers tests

- `apps/web/inngest/functions/__tests__/inngest-route.test.ts` — exports serve handler (GET/POST/PUT), registre (3 fonctions), manifest 200
- `apps/web/inngest/functions/__tests__/payment-intent-succeeded.test.ts` — happy path, skip no_invoice_id, skip invoice_not_found, propagation erreurs
- `apps/web/inngest/functions/__tests__/payment-intent-failed.test.ts` — log structuré happy path, erreur markStripeEventProcessed non-bloquante
- `apps/web/inngest/functions/__tests__/stripe-events-retention.test.ts` — schedule cron `0 3 * * *`, deletedCount loggé, appel `deleteStaleStripeEvents` avec `STRIPE_EVENTS_RETENTION_DAYS`
- `packages/services/src/__tests__/stripe-event.service.test.ts` — couverture `deleteStaleStripeEvents` (purge rows, rows récentes préservées, 0 lignes, constante exportée)
