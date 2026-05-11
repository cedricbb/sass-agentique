import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFeatureRows } from "./billing-utils";

export function FeatureComparisonTable() {
  const rows = getFeatureRows();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/4">Fonctionnalité</TableHead>
          <TableHead className="text-center">Free</TableHead>
          <TableHead className="text-center">Pro</TableHead>
          <TableHead className="text-center">Business</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-center">{row.free}</TableCell>
            <TableCell className="text-center">{row.pro}</TableCell>
            <TableCell className="text-center">{row.business}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
