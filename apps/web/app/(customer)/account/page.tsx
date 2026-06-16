import React from "react";
import Link from "next/link";
import { FileText, Receipt, FileBarChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireCustomer } from "@/lib/auth";
import { countPendingQuotesForClient } from "@saas/services/quote.service";
import { countUnpaidInvoicesForClient } from "@saas/services/invoice.service";
import { countIssuedReportsForClient } from "@saas/services/report.service";

function quotesStatText(n: number): string {
  if (n === 0) return "Aucun devis en attente";
  return n === 1 ? "1 devis en attente d'acceptation" : `${n} devis en attente d'acceptation`;
}

function invoicesStatText(n: number): string {
  if (n === 0) return "Aucune facture à payer";
  return n === 1 ? "1 facture à payer" : `${n} factures à payer`;
}

function reportsStatText(n: number): string {
  if (n === 0) return "Aucun rapport disponible";
  return n === 1 ? "1 rapport disponible" : `${n} rapports disponibles`;
}

export default async function AccountPage() {
  const { client } = await requireCustomer();

  const [quotesCount, invoicesCount, reportsCount] = await Promise.all([
    countPendingQuotesForClient(client.id),
    countUnpaidInvoicesForClient(client.id),
    countIssuedReportsForClient(client.id),
  ]);

  const CARDS = [
    { href: "/account/quotes", label: "Devis", icon: FileText, stat: quotesStatText(quotesCount) },
    { href: "/account/invoices", label: "Factures", icon: Receipt, stat: invoicesStatText(invoicesCount) },
    { href: "/account/reports", label: "Rapports", icon: FileBarChart, stat: reportsStatText(reportsCount) },
  ];

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
                <CardDescription>{c.stat}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
