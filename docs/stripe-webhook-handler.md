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
  1. STRIPE_WEBHOOKS_ENABLED !== "true"         → 503 service unavailable
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

**Toggle par appel** : `process.env.STRIPE_WEBHOOKS_ENABLED` est relu à chaque requête (pas en singleton), ce qui permet d'activer/désactiver sans redémarrage.

**Exclusion middleware auth** : la route est exclue du middleware d'authentification (même pattern que `/api/inngest`). Stripe n'envoie pas de session utilisateur — un blocage du middleware provoquerait des retries inutiles puis un abandon définitif de l'event.

**Payload size limit — double garde** : 512 KB (`MAX_WEBHOOK_PAYLOAD_BYTES`), deux contrôles complémentaires :

- **Prefilter Content-Length** (étape 2a) : si le header `content-length` est présent et dépasse 512 KB, retourne immédiatement 413 *sans* bufferiser le body. Neutralise les attaques DoS où un attaquant envoie plusieurs MB — Next.js Route Handler accepte jusqu'à 12 MB par défaut, suffisant pour épuiser la mémoire process.
- **Guard post-buffering** (étape 5) : `Buffer.byteLength(rawBody, "utf8")` sur le body déjà lu. Couverture des requêtes qui mentent sur `Content-Length` (déclarent 100 octets, envoient 10 MB). Stripe envoie toujours un `Content-Length` correct ; cette garde est une défense de fond générique.

Les deux gardes retournent le même status 413 et le même body `{ error: "payload too large" }`.

**Error message safety** : les erreurs de signature retournent `{ error: "invalid request" }` sans jamais exposer le message du SDK Stripe — prévention de fuite d'information vers un attaquant qui sonde le endpoint.

**Logging** (Pattern 16 — JSON.stringify, jamais l'objet Error brut) :

```typescript
console.error(JSON.stringify({
  event: "stripe-webhook",
  outcome: "invalid_signature" | "config_error" | "ignored" | "internal_error",
  eventId: "<si disponible>",
  message: (err as Error).message,
}));
```

## Liens vers tests

- `apps/web/lib/stripe/__tests__/webhook-handler.test.ts` — couverture exhaustive de tous les scénarios (toggle, missing/empty/oversized body, invalid signature, config error, idempotence, event ignoré, dispatch Inngest, erreur interne)
