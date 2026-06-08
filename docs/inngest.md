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

export const inngestFunctions = [paymentIntentSucceededHandler] as const;
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

Peuplé en B.1 avec `paymentIntentSucceededHandler`. Un serve handler sans fonctions est valide — Inngest retourne un manifest vide et répond 200.

**Variables d'environnement :**

| Variable | Rôle | Requis |
|---|---|---|
| `INNGEST_EVENT_KEY` | Authentification `inngest.send()` en production | Production uniquement |
| `INNGEST_SIGNING_KEY` | Vérification de signature du serve handler | Production uniquement |

En mode dev contre le Dev Server local (`inngest dev`), les deux variables sont optionnelles — Inngest fonctionne sans authentification.

**Flow Stripe webhook (A.4 + B.1) :**

```
POST /api/stripe/webhooks
  → verifyWebhookSignature()  [garantit que l'event vient de notre compte Stripe]
  → recordStripeEvent()       [idempotence — stripe-webhook-idempotence.md]
      ┌─ inserted=true  → inngest.send("stripe/payment-intent.succeeded", { event })
      └─ inserted=false → 200 already_processed (pas de dispatch)
  → Inngest dispatch → paymentIntentSucceededHandler
      ├─ step "get-invoice"    → getInvoiceById(metadata.invoiceId)
      ├─ step "create-payment" → paymentService.createPayment(...)
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

## Liens vers tests

- `apps/web/inngest/functions/__tests__/inngest-route.test.ts` — exports serve handler (GET/POST/PUT), registre, manifest 200
- `apps/web/inngest/functions/__tests__/payment-intent-succeeded.test.ts` — happy path, skip no_invoice_id, skip invoice_not_found, propagation erreurs
