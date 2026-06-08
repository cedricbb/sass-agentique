# Stripe Webhook Idempotence

## Ce que fait ce module

Garantit qu'un event Stripe livré au webhook endpoint n'est traité qu'une seule fois, même en cas de retry réseau ou de replay intentionnel. La table `stripe_events` sert de registre immuable : le double insert sur `event_id` est rejeté au niveau DB, indépendamment de la couche applicative.

## Comment l'utiliser

```typescript
import {
  recordStripeEvent,
  markStripeEventProcessed,
  getStripeEvent,
} from "@saas/services";

// Dans le handler webhook (A.4), après vérification signature :
const { inserted, record } = await recordStripeEvent({
  eventId: event.id,
  type: event.type,
  payload: event,
});

if (!inserted) {
  return new Response(null, { status: 200 }); // replay silencieux
}

// Après traitement Inngest (B.1/B.2) :
await markStripeEventProcessed(event.id);

// Lecture pour debug / observabilité :
const ev = await getStripeEvent(event.id);
```

## Architecture interne

**Table `stripe_events`** (`packages/db/src/schema.ts`) :

| Colonne | Type | Rôle |
|---------|------|------|
| `id` | uuid PK | Clé interne |
| `event_id` | text UNIQUE NOT NULL | Identifiant Stripe (`evt_…`) — contrainte d'idempotence |
| `type` | text NOT NULL | Ex. `invoice.paid`, `customer.subscription.updated` |
| `payload_json` | jsonb NOT NULL | Payload complet reçu de Stripe |
| `received_at` | timestamp NOT NULL | Horodatage insert (défaut `now()`) |
| `processed_at` | timestamp nullable | Null = handler non encore exécuté |
| `created_at` | timestamp NOT NULL | Alias audit |

Index secondaires : `stripe_events_type_idx` (filtrage par type), `stripe_events_processed_at_idx` (détection events stuck).

**Service `stripe-event.service.ts`** (`packages/services/src/`) :

- `recordStripeEvent` — INSERT via `onConflictDoNothing` sur `event_id`. Retourne `{ inserted: true }` si nouveau, `{ inserted: false }` si déjà connu.
- `markStripeEventProcessed` — UPDATE `processed_at = now()` where `event_id = ? AND processed_at IS NULL`. Retourne le record mis à jour ou `null` si déjà traité.
- `getStripeEvent` — SELECT by `event_id`, retourne `null` si absent.

**Séparation des concerns** : ce service est distinct de `stripe.service.ts` (SDK client, sync products/prices, checkout, portail). Les deux coexistent sans dépendance circulaire.

**Defense-in-depth — `payments.external_ref` unique constraint** :

La table `payments` porte un index unique `payments_external_ref_unique` sur `external_ref` (= `PaymentIntent.id` Stripe). Cet index est une couche de sécurité supplémentaire : si Inngest crash entre l'exécution d'un step `createPayment` et la persistance de son résultat, un retry tenterait d'insérer le même `external_ref` → la DB refuse avec une violation de contrainte, qui se propage comme erreur Inngest jusqu'au DLQ (3 retries max). PostgreSQL autorise plusieurs NULL dans un index unique : les paiements manuels (`external_ref = null`) ne sont pas affectés.

**Guard amount ≤ 0** :

Le handler `payment-intent-succeeded` rejette les PaymentIntents avec `amount <= 0` avant tout accès DB :

```typescript
if (!invoiceId || paymentIntent.amount <= 0) {
  await markStripeEventProcessed(stripeEvent.id);
  const reason = !invoiceId ? "no_invoice_id_metadata" : "invalid_amount";
  return { status: "skipped", reason, eventId: stripeEvent.id };
}
```

Stripe émet rarement des PI à 0 (vérifications, trials $0) — ce guard évite qu'un montant nul ne corrompe `computeInvoiceBalance`.

**Flow webhook cible (A.4 + B.x)** :

```
POST /api/stripe/webhooks
  → verifyWebhookSignature(rawBody, signature) [stripe.service.ts — A.2]
  → recordStripeEvent()
      ┌─ inserted=true  → enqueue Inngest (A.3)
      └─ inserted=false → return 200 (no-op)
  → Inngest fn payment-intent-succeeded
      → guard: !invoiceId || amount <= 0 → skip (markStripeEventProcessed + return)
      → createPayment() [payments_external_ref_unique protège contre doublon DB]
      → markStripeEventProcessed(eventId)
```

**Observabilité** : `received_at` est posé à l'insert, `processed_at` après handler success. Les events avec `processed_at IS NULL` après N minutes indiquent un handler bloqué.

## Considérations sécurité / RGPD

`payload_json` stocke le payload Stripe complet, qui peut contenir des données personnelles (email client, derniers 4 digits carte). Le champ n'est pas chiffré au repos. Une politique de rétention ou de masquage sera traitée en R7 si nécessaire (voir `security.md` de la tâche `feat-r6-a1-stripe-events-table`).

## Liens vers tests

- `packages/db/src/__tests__/schema.test.ts` — structure DDL, colonnes, index, types exportés ; inclut `possede_un_unique_index_sur_external_ref` (payments)
- `packages/services/src/__tests__/stripe-event.service.test.ts` — insert, conflict, update, lookup
- `apps/web/inngest/functions/__tests__/payment-intent-succeeded.test.ts` — guard amount ≤ 0 (`skips_when_amount_is_zero`, `skips_when_amount_is_negative`), reason discrimination, happy path non-régression
- `apps/web/lib/stripe/__tests__/webhook-integration.test.ts` — teste l'idempotence réelle de bout en bout : 2 POST consécutifs avec le même `eventId` → 2e retourne `already_processed`, `inngest.send` appelé une seule fois au total ; la logique `onConflictDoNothing` + fallback SELECT est exercée sans mock drizzle métier
