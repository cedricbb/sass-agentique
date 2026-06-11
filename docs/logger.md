# Logger structuré (`@saas/services/logger`)

## Ce que fait le logger

Module zero-dépendance qui émet des logs JSON sur stdout, avec filtrage par niveau configurable via `LOG_LEVEL`. Conçu pour produire des logs exploitables dans Vercel/CI sans texte libre non-structuré.

## Comment l'utiliser

```ts
import { logger } from "@saas/services/logger";

logger.info("Facture créée", { invoice_id: "inv_123", customer_id: "cust_456" });
logger.error("Paiement échoué", { err: new Error("Card declined"), stripe_event_id: "evt_789" });
logger.warn("Tentative suspecte", { user_id: "u_1", attempts: 5 });
logger.debug("Payload Stripe reçu", { event_type: "invoice.paid" });
```

Chaque appel émet une ligne JSON sur stdout :

```json
{
  "level": "info",
  "timestamp": "2026-06-11T12:34:56.789Z",
  "message": "Facture créée",
  "invoice_id": "inv_123",
  "customer_id": "cust_456"
}
```

### Import subpath (recommandé)

```ts
import { logger } from "@saas/services/logger";
```

Charge uniquement le logger sans tirer le reste du barrel `@saas/services`.

### Import via barrel (compatibilité)

```ts
import { logger } from "@saas/services";
```

## Architecture interne

### Interface

```ts
type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

export const logger = {
  debug(msg: string, ctx?: LogContext): void,
  info(msg: string, ctx?: LogContext): void,
  warn(msg: string, ctx?: LogContext): void,
  error(msg: string, ctx?: LogContext): void,
};
```

### Filtrage par niveau

Ordre : `debug=0 < info=1 < warn=2 < error=3`. Tout appel dont le niveau est inférieur au `LOG_LEVEL` configuré est un no-op silencieux.

Variable d'environnement : `LOG_LEVEL` (`debug | info | warn | error`, défaut `info`), validée par `@saas/config`.

### Routage console

- `debug`, `info` → `console.info` (évite le filtrage runtime de `console.debug`)
- `warn` → `console.warn`
- `error` → `console.error`

### Sérialisation des erreurs

`JSON.stringify(new Error("x"))` retourne `"{}"` en JavaScript natif car les propriétés `name`, `message`, `stack` ne sont pas énumérables. `serializeContext` les extrait explicitement :

```ts
// ctx = { err: new Error("boom") }
// → { "err": { "name": "Error", "message": "boom", "stack": "Error: boom\n  at ..." } }
```

### Configuration `LOG_LEVEL` dans `@saas/config`

```ts
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
```

## Liens vers tests

- `packages/services/src/__tests__/logger.test.ts` — suite complète (émission JSON, sérialisation Error, filtrage niveau, routage console)
- `packages/config/src/__tests__/env.test.ts` — validation Zod de `LOG_LEVEL`
