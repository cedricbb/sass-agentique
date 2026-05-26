"use client";

import * as React from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CreateContractInput } from "@/lib/schemas/contract.schemas";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ClientOption = { id: string; name: string };
type PrestationOption = { id: string; name: string };
type FormType = UseFormReturn<CreateContractInput>;

type ContractFormFieldsProps = {
  form: FormType;
  clients: ClientOption[];
  prestations: PrestationOption[];
  isStripeAuto: boolean;
  onPrestationChange: (prestationId: string) => void;
};

function ClientField({ form, clients }: { form: FormType; clients: ClientOption[] }) {
  return (
    <FormField
      control={form.control}
      name="clientId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Client</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger data-testid="contract-client-select">
                <SelectValue placeholder="Sélectionner un client" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PrestationField({ form, prestations, onPrestationChange }: { form: FormType; prestations: PrestationOption[]; onPrestationChange: (id: string) => void }) {
  return (
    <FormField
      control={form.control}
      name="prestationId"
      render={() => (
        <FormItem>
          <FormLabel>Prestation</FormLabel>
          <Select onValueChange={onPrestationChange} defaultValue={form.getValues("prestationId")}>
            <FormControl>
              <SelectTrigger data-testid="contract-prestation-select">
                <SelectValue placeholder="Sélectionner une prestation" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {prestations.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function BillingModeField({ form }: { form: FormType }) {
  return (
    <FormField
      control={form.control}
      name="billingMode"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Mode de facturation</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger data-testid="contract-billing-mode-select">
                <SelectValue placeholder="Mode de facturation" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="manual_invoice">Facturation manuelle</SelectItem>
              <SelectItem value="stripe_auto">Stripe (auto)</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function MonthlyPriceField({ form, isStripeAuto }: { form: FormType; isStripeAuto: boolean }) {
  return (
    <FormField
      control={form.control}
      name="monthlyPriceEurCents"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Prix mensuel (centimes EUR)</FormLabel>
          <FormControl>
            <Input
              type="number"
              data-testid="contract-monthly-price-input"
              readOnly={isStripeAuto}
              {...field}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
          </FormControl>
          {isStripeAuto && (
            <p className="text-sm text-muted-foreground" data-testid="stripe-auto-hint">
              Piloté par Stripe
            </p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function StartDateField({ form }: { form: FormType }) {
  return (
    <FormField
      control={form.control}
      name="startedAt"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Date de début</FormLabel>
          <FormControl>
            <Input
              type="date"
              data-testid="contract-started-at-input"
              {...field}
              value={field.value instanceof Date ? field.value.toISOString().split("T")[0] : (field.value ?? "")}
              onChange={(e) => field.onChange(new Date(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ContractFormFields({ form, clients, prestations, isStripeAuto, onPrestationChange }: ContractFormFieldsProps) {
  if (prestations.length === 0) {
    return <p data-testid="no-recurring-message">Aucune prestation récurrente disponible</p>;
  }
  return (
    <>
      <ClientField form={form} clients={clients} />
      <PrestationField form={form} prestations={prestations} onPrestationChange={onPrestationChange} />
      <BillingModeField form={form} />
      <MonthlyPriceField form={form} isStripeAuto={isStripeAuto} />
      <StartDateField form={form} />
    </>
  );
}
