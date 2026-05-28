import Link from "next/link";
import { FileText, Receipt, FileBarChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const CARDS = [
  { href: "/account/quotes", label: "Devis", icon: FileText },
  { href: "/account/invoices", label: "Factures", icon: Receipt },
  { href: "/account/reports", label: "Rapports", icon: FileBarChart },
];

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Espace client</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="items-center text-center">
                <c.icon size={28} className="text-muted-foreground" />
                <CardTitle className="text-sm">{c.label}</CardTitle>
                <CardDescription>Bientôt disponible</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
