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

**Flow webhook cible (A.4 + B.x)** :

```
POST /api/stripe/webhooks
  → vérification signature (A.2)
  → recordStripeEvent()
      ┌─ inserted=true  → enqueue Inngest (A.3)
      └─ inserted=false → return 200 (no-op)
  → Inngest fn (B.x) exécute le handler métier
  → markStripeEventProcessed(eventId)
```

**Observabilité** : `received_at` est posé à l'insert, `processed_at` après handler success. Les events avec `processed_at IS NULL` après N minutes indiquent un handler bloqué.

## Considérations sécurité / RGPD

`payload_json` stocke le payload Stripe complet, qui peut contenir des données personnelles (email client, derniers 4 digits carte). Le champ n'est pas chiffré au repos. Une politique de rétention ou de masquage sera traitée en R7 si nécessaire (voir `security.md` de la tâche `feat-r6-a1-stripe-events-table`).

## Liens vers tests

- `packages/db/src/__tests__/schema.test.ts` — structure DDL, colonnes, index, types exportés
- `packages/services/src/__tests__/stripe-event.service.test.ts` — insert, conflict, update, lookup
