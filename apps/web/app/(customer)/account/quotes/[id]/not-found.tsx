import Link from "next/link";

export default function CustomerQuoteNotFound() {
  return (
    <div className="space-y-4 py-8 text-center" data-testid="quote-not-found">
      <h2 className="text-lg font-semibold">Devis introuvable</h2>
      <p className="text-sm text-muted-foreground">
        Ce devis n&apos;existe pas ou n&apos;est plus disponible.
      </p>
      <Link
        href="/account/quotes"
        className="text-sm text-primary hover:underline"
        data-testid="quote-not-found-back"
      >
        Retour aux devis
      </Link>
    </div>
  );
}
