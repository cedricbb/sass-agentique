import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "./billing-utils";

export interface Invoice {
  id: string;
  date: Date;
  amountCents: number;
  status: string;
  issuedAt: Date | null;
}

export function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <TableRow>
      <TableCell>{invoice.date.toLocaleDateString("fr-FR")}</TableCell>
      <TableCell>{formatPrice(invoice.amountCents)} €</TableCell>
      <TableCell>
        <Badge variant={invoice.status === "paid" ? "default" : "destructive"}>
          {invoice.status === "paid" ? "Payée" : "Impayée"}
        </Badge>
      </TableCell>
      <TableCell>
        {invoice.issuedAt != null && (
          <a
            href={`/api/invoices/${invoice.id}/file`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline"
          >
            PDF
          </a>
        )}
      </TableCell>
    </TableRow>
  );
}
