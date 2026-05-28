import Link from "next/link";

export default function CustomerInvoiceNotFound() {
  return (
    <div className="space-y-4 py-8 text-center" data-testid="invoice-not-found">
      <h2 className="text-lg font-semibold">Facture introuvable</h2>
      <p className="text-sm text-muted-foreground">
        Cette facture n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Link
        href="/account/invoices"
        className="text-sm text-primary hover:underline"
        data-testid="invoice-not-found-back"
      >
        Retour aux factures
      </Link>
    </div>
  );
}
