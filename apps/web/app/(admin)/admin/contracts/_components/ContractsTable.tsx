"use client";

import * as React from "react";
import { useQueryState, parseAsString } from "nuqs";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelContractAction } from "@/app/actions/contracts";
import { ContractFilters } from "./ContractFilters";
import { ContractRow } from "./ContractRow";
import type { ContractRowData } from "./ContractRow";

const COLUMN_HEADERS = ["Client", "Prestation", "Mode", "Statut", "Prix mensuel", "Période", "Actions"];

interface ContractsTableProps {
  data: ContractRowData[];
  clientNames: Record<string, string>;
  prestationNames: Record<string, string>;
}

export function ContractsTable({ data, clientNames, prestationNames }: ContractsTableProps) {
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("all"));
  const [billingMode, setBillingMode] = useQueryState("billingMode", parseAsString.withDefault("all"));
  const [pending, setPending] = React.useState<string | null>(null);
  const filteredData = data.filter((row) =>
    (status === "all" || row.status === status) && (billingMode === "all" || row.billingMode === billingMode),
  );
  async function handleCancel(contractId: string) {
    setPending(contractId);
    await cancelContractAction(contractId);
    setPending(null);
  }
  return (
    <div>
      <ContractFilters status={status} onStatusChange={setStatus} billingMode={billingMode} onBillingModeChange={setBillingMode} />
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMN_HEADERS.map((h) => <TableHead key={h}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row) => (
            <ContractRow key={row.id} row={row} clientName={clientNames[row.clientId] ?? "—"} prestationName={prestationNames[row.prestationId] ?? "—"} pending={pending === row.id} onCancel={handleCancel} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
