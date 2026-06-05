# Customer Portal — Paiements

## Ce que fait ce module

Expose la liste des paiements reçus au customer portail, en lecture seule et scoped sur le client authentifié. Chaque paiement est enrichi avec le numéro de facture associé. La page `/account/payments` affiche un tableau 4 colonnes (Date, Montant TTC, Méthode, Facture) accessible depuis le 7e item de la sidebar.

## Comment l'utiliser

```ts
import { listPaymentsForCustomerPortal, type PaymentWithInvoiceInfo } from "@saas/services";

const payments = await listPaymentsForCustomerPortal(client.id);
// → PaymentWithInvoiceInfo[] triés paidAt DESC
```

Le type `PaymentWithInvoiceInfo` étend `Payment` avec un champ supplémentaire :

```ts
type PaymentWithInvoiceInfo = Payment & {
  invoiceNumber: string;
};
```

`amountEurCents` est TTC (cohérent avec `isFullyPaid` du service factures). La page divise par 100 via `formatCurrency(payment.amountEurCents / 100)`.

## Architecture interne

**Service — Cross-client isolation via JOIN structurel** — la query filtre `WHERE invoices.clientId = clientId` via `innerJoin`. Un paiement lié à une facture d'un autre client est exclu structurellement, sans guard applicatif supplémentaire.

```ts
db.select({ ...payments, invoiceNumber: invoices.number })
  .from(payments)
  .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
  .where(eq(invoices.clientId, clientId))
  .orderBy(desc(payments.paidAt))
```

**Page UI — Server Component** (`apps/web/app/(customer)/account/payments/page.tsx`) : appelle `requireCustomer()` puis `paymentService.listPaymentsForCustomerPortal`. Les labels et variants Badge sont définis inline (pas de `_lib` séparé, aucune page détail prévue) :

```ts
const PAYMENT_METHOD_LABELS = {
  stripe_card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  other: "Autre",
}

const PAYMENT_METHOD_VARIANT = {
  stripe_card: "default",
  bank_transfer: "secondary",
  other: "outline",
}
```

**Navigation** — `CustomerSidebar.tsx` : item `CreditCard` en position 4 (index 3), entre "Mes factures" et "Mes rapports". `CustomerShell.tsx` : `PAGE_TITLES.payments = "Mes paiements"`.

**data-testids** : `payments-table`, `payment-row`, `payment-method-badge`, `payment-invoice-link`, `payments-empty`.

Pas de page détail paiement (décision produit) — pas de route `getPaymentByIdForClient`.

## Liens vers tests

- `packages/services/src/__tests__/payment.service.test.ts` — 5 tests service (isolation cross-client, tri, champ invoiceNumber)
- `apps/web/app/(customer)/account/payments/__tests__/page.test.tsx` — 7 tests UI (tableau, empty state, badges méthode, lien facture, suffixe TTC, sidebar nav, shell title)
- `apps/web/tests/e2e/customer-payments.spec.ts` — 4 tests e2e Playwright (liste nominal Acme, empty state Globex, sidebar 7 items, isolation cross-client)
