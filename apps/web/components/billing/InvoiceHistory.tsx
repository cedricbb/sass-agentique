import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceRow, type Invoice } from "./InvoiceRow";

export function InvoiceHistory({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune facture pour le moment</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Montant</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Télécharger</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <InvoiceRow key={inv.id} invoice={inv} />
        ))}
      </TableBody>
    </Table>
  );
}
