import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ContractFiltersProps {
  status: string;
  onStatusChange: (value: string) => void;
  billingMode: string;
  onBillingModeChange: (value: string) => void;
}

export function ContractFilters({ status, onStatusChange, billingMode, onBillingModeChange }: ContractFiltersProps) {
  return (
    <div className="flex items-center gap-4 py-4">
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="contracts-filter-status">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="active">Actif</SelectItem>
          <SelectItem value="past_due">En retard</SelectItem>
          <SelectItem value="canceled">Annulé</SelectItem>
        </SelectContent>
      </Select>
      <Select value={billingMode} onValueChange={onBillingModeChange}>
        <SelectTrigger className="h-8 w-[180px]" data-testid="contracts-filter-mode">
          <SelectValue placeholder="Mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les modes</SelectItem>
          <SelectItem value="manual_invoice">Facturation manuelle</SelectItem>
          <SelectItem value="stripe_auto">Stripe (auto)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
