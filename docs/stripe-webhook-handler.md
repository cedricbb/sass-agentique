# Stripe Webhook Handler

## Ce que fait ce module

Point d'entrée de tous les events Stripe en production. Expose `POST /api/stripe/webhooks` et orchestre la chaîne de défense complète : toggle d'activation, vérification de signature HMAC, idempotence DB, dispatch Inngest vers les handlers métier.

Composé de deux fichiers : `apps/web/app/api/stripe/webhooks/route.ts` (thin wrapper Next.js) et `apps/web/lib/stripe/webhook-handler.ts` (logique pure testable en isolation).

## Comment l'utiliser

Le endpoint est appelé exclusivement par Stripe (side-to-side, pas depuis le frontend). L'URL doit être enregistrée dans le dashboard Stripe sandbox.

**Variables d'environnement requises** (évaluées à chaque appel, pas en cache) :

```bash
STRIPE_WEBHOOKS_ENABLED="true"      # Toggle strict opt-in ; "false" → 503
STRIPE_WEBHOOK_SECRET="whsec_..."   # Secret de signature webhook Stripe
STRIPE_SECRET_KEY="sk_test_..."     # Requis par le client SDK Stripe
```

**Types d'events dispatchés vers Inngest** :

| Event Stripe | Event Inngest |
|---|---|
| `payment_intent.succeeded` | `stripe/payment-intent.succeeded` |
| `payment_intent.payment_failed` | `stripe/payment-intent.failed` |

Tous les autres types sont reçus, enregistrés en DB via idempotence, puis retournés 200 `{ status: "ignored" }` — Stripe ne les considère pas comme échoués.

## Architecture interne

**Flow complet** :

```
POST /api/stripe/webhooks
  1. env.STRIPE_WEBHOOKS_ENABLED === false        → 503 service unavailable
  2a. content-length header présent
        ET declaredBytes > 512 KB               → 413 payload too large  (sans buffering)
  2b. await request.text()  (raw string, HMAC)
  3. stripe-signature header absent              → 400 missing signature
  4. body vide                                   → 400 empty body
  5. Buffer.byteLength(rawBody, "utf8") > 512 KB → 413 payload too large
  6. verifyWebhookSignature(rawBody, signature)
       stripe/config_error                       → 503 service unavailable
       stripe/invalid_signature                  → 400 invalid request (message générique)
  7. recordStripeEvent(event.id, event.type, event)
       inserted=false                            → 200 already_processed
  8. isDispatchedEventType(event.type) ?
       non                                       → 200 ignored
       oui → inngest.send({ name, data: { event } })
  9.                                             → 200 { received: true, eventId, status: "dispatched" }

  Exception non gérée (DB down, Inngest down)   → 500 internal error
```

**Séparation route / handler** : `route.ts` délègue immédiatement à `handleStripeWebhook(request)`. La logique dans `webhook-handler.ts` est une fonction pure importable en test sans monter un serveur Next.js.

**Contrainte raw body** : `await request.text()` est requis avant la vérification HMAC. `req.json()` invaliderait la signature car Stripe signe le payload brut. Le prefilter Content-Length court-circuite ce buffering uniquement quand le header révèle un dépassement sans ambiguïté.

**Toggle par appel** : `env.STRIPE_WEBHOOKS_ENABLED` (boolean, `@saas/config`) est évalué à chaque requête. Le singleton `env` parse les vars d'environnement au démarrage du process ; un changement de valeur nécessite un redémarrage du serveur. Défaut : `false` (strict opt-in — absent = désactivé).

**Exclusion middleware auth** : la route est exclue du middleware d'authentification (même pattern que `/api/inngest`). Stripe n'envoie pas de session utilisateur — un blocage du middleware provoquerait des retries inutiles puis un abandon définitif de l'event.

**Payload size limit — double garde** : 512 KB (`MAX_WEBHOOK_PAYLOAD_BYTES`), deux contrôles complémentaires :

- **Prefilter Content-Length** (étape 2a) : si le header `content-length` est présent et dépasse 512 KB, retourne immédiatement 413 *sans* bufferiser le body. Neutralise les attaques DoS où un attaquant envoie plusieurs MB — Next.js Route Handler accepte jusqu'à 12 MB par défaut, suffisant pour épuiser la mémoire process.
- **Guard post-buffering** (étape 5) : `Buffer.byteLength(rawBody, "utf8")` sur le body déjà lu. Couverture des requêtes qui mentent sur `Content-Length` (déclarent 100 octets, envoient 10 MB). Stripe envoie toujours un `Content-Length` correct ; cette garde est une défense de fond générique.

Les deux gardes retournent le même status 413 et le même body `{ error: "payload too large" }`.

**Error message safety** : les erreurs de signature retournent `{ error: "invalid request" }` sans jamais exposer le message du SDK Stripe — prévention de fuite d'information vers un attaquant qui sonde le endpoint.

**Logging structuré** (`@saas/services/logger`) :

| Milestone | Niveau | Clés de contexte |
|---|---|---|
| `webhook.stripe.received` | `info` | `eventId`, `eventType` |
| `webhook.stripe.disabled` | `warn` | — |
| `webhook.stripe.signature_invalid` | `warn` | `err` |
| `webhook.stripe.body_too_large` | `warn` | — |
| `webhook.stripe.duplicate` | `info` | `eventId`, `eventType` |
| `webhook.stripe.dispatched` | `info` | `eventId`, `eventType` |
| `webhook.stripe.error` | `error` | `eventId`, `eventType`, `err` |

```ts
import { logger } from "@saas/services/logger";

logger.info("webhook.stripe.dispatched", { eventId: event.id, eventType: event.type });
logger.warn("webhook.stripe.signature_invalid", { err });
logger.error("webhook.stripe.error", { eventId: event.id, eventType: event.type, err });
```

Les milestones précoces (avant parse — ex. `signature_invalid`) émettent sans `eventId`/`eventType` car le payload n'a pas encore été décodé. Les erreurs de signature ne retournent toujours pas le message SDK au client (`{ error: "invalid request" }`).

## Liens vers tests

- `apps/web/lib/stripe/__tests__/webhook-handler.test.ts` — couverture exhaustive de tous les scénarios (toggle, missing/empty/oversized body, invalid signature, config error, idempotence, event ignoré, dispatch Inngest, erreur interne)
- `apps/web/lib/stripe/__tests__/webhook-integration.test.ts` — tests d'intégration chaîne complète : mock uniquement au niveau Stripe SDK (`constructEvent`) et drizzle (`db.insert/select/update`), tout le reste s'exécute réellement ; couvre happy paths PI.succeeded + PI.failed, idempotence replay cross-call, wrap `StripeSignatureVerificationError → StripeServiceError`, event inconnu
