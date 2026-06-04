# Customer Portal — Paiements

## Ce que fait ce module

Expose la liste des paiements reçus au customer portail, en lecture seule et scoped sur le client authentifié. Chaque paiement est enrichi avec le numéro de facture associé.

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

`amountEurCents` est TTC (cohérent avec `isFullyPaid` du service factures). Aucun helper de conversion n'est nécessaire côté affichage.

## Architecture interne

**Cross-client isolation via JOIN structurel** — la query filtre `WHERE invoices.clientId = clientId` via `innerJoin`. Un paiement lié à une facture d'un autre client est exclu structurellement, sans guard applicatif supplémentaire.

```ts
db.select({ ...payments, invoiceNumber: invoices.number })
  .from(payments)
  .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
  .where(eq(invoices.clientId, clientId))
  .orderBy(desc(payments.paidAt))
```

Pas de guard UUID sur `clientId` : la fonction est consommée uniquement par `requireCustomer()` qui garantit un UUID valide via auth. Il n'existe pas de route `getPaymentByIdForClient` (décision produit : page liste uniquement).

## Liens vers tests

`packages/services/src/__tests__/payment.service.test.ts` — 5 tests dédiés :
- retour ordonné paidAt DESC scopé sur clientId
- présence du champ `invoiceNumber`
- tableau vide si aucun paiement
- exclusion stricte des paiements cross-client
- vérification `innerJoin` + filtre `clientId` dans la query Drizzle
