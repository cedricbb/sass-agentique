"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContractSchema, type CreateContractInput } from "@/lib/schemas/contract.schemas";

type ClientOption = { id: string; name: string };
type PrestationOption = { id: string; name: string; basePriceEurCents: number };
import { createContractAction } from "@/app/actions/contracts";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { ContractFormFields } from "./ContractFormFields";

type ContractFormProps = {
  clients: ClientOption[];
  prestations: PrestationOption[];
};

const FORM_DEFAULTS = {
  clientId: "",
  prestationId: "",
  billingMode: "manual_invoice" as const,
  monthlyPriceEurCents: 0,
};

function buildPrestationChangeHandler(
  prestations: PrestationOption[],
  form: UseFormReturn<CreateContractInput>
) {
  return (prestationId: string) => {
    const prestation = prestations.find((p) => p.id === prestationId);
    if (!prestation) return;
    form.setValue("monthlyPriceEurCents", prestation.basePriceEurCents);
    form.setValue("prestationId", prestationId);
  };
}

function buildSubmitHandler(
  startTransition: (callback: () => void) => void,
  router: { push: (url: string) => void }
) {
  return (values: CreateContractInput) => {
    startTransition(async () => {
      const result = await createContractAction(values);
      if (toastResult(result, "Contrat créé")) {
        router.push("/admin/contracts");
      }
    });
  };
}

export function ContractForm({ clients, prestations }: ContractFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<CreateContractInput>({
    resolver: zodResolver(createContractSchema),
    defaultValues: { ...FORM_DEFAULTS, startedAt: new Date() },
  });
  const isStripeAuto = form.watch("billingMode") === "stripe_auto";
  const handlePrestationChange = buildPrestationChangeHandler(prestations, form);
  const handleSubmit = buildSubmitHandler(startTransition, router);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-w-lg">
        <ContractFormFields
          form={form}
          clients={clients}
          prestations={prestations}
          isStripeAuto={isStripeAuto}
          onPrestationChange={handlePrestationChange}
        />
        <Button type="submit" disabled={isPending || prestations.length === 0} data-testid="contract-submit">
          Créer le contrat
        </Button>
      </form>
    </Form>
  );
}
