# stripe.service

## Ce que fait stripe.service

Expose le client SDK Stripe via un lazy singleton thread-safe, fournit le helper `verifyWebhookSignature` pour la vérification de signature webhook, et encapsule les opérations Stripe (customer, checkout, portail, abonnements) dans la classe `StripeService`.

## Comment l'utiliser

### Lazy singleton

```typescript
import { getStripeClient, __resetStripeClientForTests } from "@saas/services";

// Retourne le singleton Stripe, l'instancie au premier appel
const stripe = getStripeClient();

// Test isolation : réinitialise le singleton entre les cas de test
__resetStripeClientForTests();
```

`getStripeClient()` lance une `StripeServiceError("stripe/config_error")` si `STRIPE_SECRET_KEY` n'est pas définie. Le singleton est re-créé automatiquement si la valeur de `STRIPE_SECRET_KEY` change entre deux appels (utile en test).

### Vérification de signature webhook

```typescript
import { verifyWebhookSignature } from "@saas/services";

// Dans le handler POST /api/stripe/webhooks (A.4) :
const rawBody = await req.text();
const signature = req.headers.get("stripe-signature") ?? "";

// Lève StripeServiceError("stripe/invalid_signature") si la signature est invalide
// Lève StripeServiceError("stripe/config_error") si STRIPE_WEBHOOK_SECRET est absent
const event = verifyWebhookSignature(rawBody, signature);
```

`rawBody` accepte `string | Buffer` (compatible Next.js `await req.text()`).

## Architecture interne

**Lazy singleton** (`packages/services/src/stripe.service.ts`) :

```
let _stripeClient: Stripe | null = null
let _stripeClientKey: string | null = null

getStripeClient()
  → lit process.env.STRIPE_SECRET_KEY
  → throws StripeServiceError("stripe/config_error") si absent
  → re-instancie si la clé a changé (tests)
  → retourne _stripeClient
```

**Détection de changement de clé** : le module stocke `_stripeClientKey` en parallèle du client. Si `STRIPE_SECRET_KEY` change entre deux appels (pattern courant en test via `vi.stubEnv`), le client est re-créé silencieusement.

**`verifyWebhookSignature`** : délègue à `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`. Les erreurs SDK Stripe sont interceptées et re-levées en `StripeServiceError` typées pour isoler les callers de l'API SDK.

**`StripeService` class** : conservée pour compatibilité, le constructeur n'instancie plus le client (lazy). L'accès SDK interne passe par un getter privé `get stripe()` → `getStripeClient()`.

**Zod env validation** (`packages/config/src/index.ts`) :

Si `STRIPE_WEBHOOKS_ENABLED === "true"`, le schéma exige `STRIPE_SECRET_KEY` et `STRIPE_WEBHOOK_SECRET` non-vides. Sinon les deux sont optionnels. Calque Pattern 18 (même mécanique que `RESEND_API_KEY ↔ NOTIFICATIONS_ENABLED`).

## Liens vers tests

- `packages/services/src/__tests__/stripe.service.test.ts` — singleton, lazy init, re-instanciation sur changement clé, `__resetStripeClientForTests`, `verifyWebhookSignature` (valid / invalid / config_error)
- `packages/config/src/__tests__/env.test.ts` — refines Zod conditionnels `STRIPE_WEBHOOKS_ENABLED`
