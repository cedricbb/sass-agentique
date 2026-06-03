# Customer Portal Notifications

## Architecture

Notifications are sent inline within existing API route handlers using a try/catch pattern. When an admin transitions an entity (quote, invoice, report) to a notifiable status, the route calls `notificationService.notify(event)` after the database write. Failures are logged via `console.error` but never bubble up — the primary operation always succeeds.

Entry point: `packages/services/src/notification.service.ts`  
Email transport: `packages/services/src/email.service.ts` → Resend API

The killswitch (`NOTIFICATIONS_ENABLED`) is read from `process.env` at call time, so toggling the env var and restarting the server takes effect immediately without code change.

## Events

| Event | Trigger | Recipient | Template |
|---|---|---|---|
| `quote.sent` | Admin transitions quote status → `sent` | Customer email on quote | "Your quote is ready" |
| `invoice.sent` | Admin transitions invoice status → `sent` | Customer email on invoice | "Your invoice is ready" |
| `report.issued` | Admin transitions report status → `issued` | Customer email on report | "Your report is available" |

All events carry: `customerEmail`, `customerName`, `entityId`, `entityReference`, `portalUrl`.

## Audience contract

- **Sender**: configured Resend sender address (env-driven, no hardcoded address)
- **Recipient**: the email stored on the entity at transition time
- **CC / BCC**: none
- **Unsubscribe**: not implemented (R5 scope); users cannot opt out individually
- **Retry**: none — single attempt per transition; failed sends are logged only
- **Idempotency**: no deduplication guard; re-transitioning an entity (e.g., re-sending a quote) triggers a second email

## Toggle killswitch

`NOTIFICATIONS_ENABLED=true` enables dispatch. Any other value (absent, `"false"`, `"TRUE"`) disables all dispatch silently.

| State | Behaviour |
|---|---|
| `NOTIFICATIONS_ENABLED=true` | Emails dispatched; `RESEND_API_KEY` required at startup (fail-fast) |
| `NOTIFICATIONS_ENABLED` absent or `!= "true"` | `notificationService.notify()` returns immediately, no Resend call |

Startup validation (zod refine in `@saas/config`): if `NOTIFICATIONS_ENABLED=true`, then `RESEND_API_KEY` must be a non-empty string. The app crashes at boot rather than failing silently on the first send.

Case sensitivity: only the exact lowercase string `"true"` activates notifications. `"TRUE"`, `"True"`, `"1"` are treated as disabled.

## Smoke test instructions

Prerequisites: running app, admin account, at least one quote + invoice + report with a customer email set.

```bash
# Enable notifications (dev: safe to use a test Resend key)
NOTIFICATIONS_ENABLED=true RESEND_API_KEY=re_test_xxx pnpm dev

# Trigger events via admin UI:
# 1. Quotes → select quote → transition to "Sent"
# 2. Invoices → select invoice → transition to "Sent"
# 3. Reports → select report → transition to "Issued"
```

Expected log output (JSON, one line per event):
```json
{"level":"info","event":"quote.sent","entityId":"<uuid>","recipient":"<email>"}
{"level":"info","event":"invoice.sent","entityId":"<uuid>","recipient":"<email>"}
{"level":"info","event":"report.issued","entityId":"<uuid>","recipient":"<email>"}
```

With `NOTIFICATIONS_ENABLED` absent or not `"true"`, the transitions succeed but no log lines appear and no emails are sent.

Actual mail delivery to inbox is out of CI scope — verify via Resend dashboard or a test inbox (Mailtrap/Mailpit).

## Known technical debt

**Resend client duplication (R5-B1 finding #3)**: Two independent code paths create Resend instances.

- `email.service.ts`: instantiates `new Resend(env.RESEND_API_KEY)` inline on each call (stateless, no singleton)
- `notification.service.ts`: uses a `getResendClient()` singleton accessor

Both paths are functional. Risk: diverging configuration if one is updated without the other. Consolidation target: R6+ — extract a shared `resend-client.ts` module and remove the duplicate instantiation from `email.service.ts`.

**NOTIFICATIONS_ENABLED read outside zod** (cosmetic): `notification.service.ts` reads `process.env.NOTIFICATIONS_ENABLED` directly rather than via the validated `env` object from `@saas/config`. Safe because both read from the same `process.env` source, but the pattern diverges from the rest of the codebase. Cleanup target: R6+ migration to `env.NOTIFICATIONS_ENABLED` after confirming the type stays `string | undefined`.
