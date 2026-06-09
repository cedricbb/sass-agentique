# payment.service

## Ce que fait payment.service

Gère l'enregistrement et la suppression des paiements liés aux factures, et expose `recomputePaidAtForInvoice` — la fonction canonique de réconciliation de l'état "payé" d'une facture.

## Comment l'utiliser

### `createPayment(input: NewPayment)`

Insère un paiement et appelle `recomputePaidAtForInvoice` dans la même transaction. Retourne `{ payment, invoiceMarkedAsPaid }`.

```ts
const { payment, invoiceMarkedAsPaid } = await createPayment({
  invoiceId,
  amountCents,
  paidAt: new Date(),
  stripePaymentIntentId,
});
```

### `recomputePaidAtForInvoice(invoiceId, tx?)`

Recalcule l'état payé d'une facture après toute mutation de paiements (insert, void, remboursement). Peut être passée une transaction `tx` ou opérer sur `db` directement.

Retourne `{ wasMarkedAsPaid: boolean }` :
- `true` : la facture vient de passer à `"paid"` (transition effectuée).
- `false` : paiement partiel, facture déjà payée, ou statut immuable (`"draft"` / `"cancelled"`).

```ts
const { wasMarkedAsPaid } = await recomputePaidAtForInvoice(invoiceId);
```

**Idempotente** : safe à rappeler. Si la facture est déjà `"paid"` avec `paidAt` défini, la fonction retourne `false` sans mutation supplémentaire.

**Statuts immuables** : `"draft"` et `"cancelled"` ne peuvent pas transitionner vers `"paid"` — appel sans effet.

**Convention TTC/HT** : la comparaison "totalement payé" utilise `computeInvoiceTtc(invoice)` (montant TTC) face à la somme des `amountCents` des payments (également TTC). Ne pas confondre avec `totalEurCents` en DB qui est HT.

### `deletePayment(id)`

Supprime un paiement. Lève `PaymentDeletionOnPaidInvoiceError` si la facture est déjà marquée `"paid"`.

## Architecture interne

`recomputePaidAtForInvoice` a été extraite de `createPayment` (R7 F1) pour répondre à deux besoins :

1. **Testabilité** : la logique de réconciliation est testable sans passer par tout le flow `createPayment` + Stripe.
2. **Réutilisabilité** : un futur void/remboursement/annulation peut appeler `recomputePaidAtForInvoice` sans dupliquer la logique de comparaison TTC.

Séquence dans `createPayment` :
```
INSERT payment → recomputePaidAtForInvoice(invoiceId, tx) → return { payment, invoiceMarkedAsPaid }
```

La fonction s'appuie sur `computeInvoiceBalance` (invoice.service) pour le calcul TTC et sur `invoiceService.canTransitionInvoice` + `invoiceService.transitionInvoiceStatus` pour la mutation de statut.

## Liens vers tests

- `packages/services/src/__tests__/payment.service.test.ts` — couverture `createPayment` et `recomputePaidAtForInvoice` (AC1–AC4 : paiement total, partiel, draft no-op, cancelled no-op)
