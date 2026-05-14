"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Prestation } from "@saas/db";
import {
  createPrestationSchema,
  type PrestationCreateValues,
} from "@/lib/schemas/prestation.schemas";
import {
  createPrestationAction,
  updatePrestationAction,
} from "@/app/actions/prestations";
import { toastResult } from "@/lib/toast";
import { ArchivePrestationButton } from "./ArchivePrestationButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const KIND_OPTIONS: readonly { value: "one_shot" | "recurring"; label: string }[] = [
  { value: "one_shot", label: "Ponctuelle" },
  { value: "recurring", label: "Récurrente" },
] as const;

interface PrestationFormProps {
  initialData?: Prestation;
}

export function PrestationForm({ initialData }: PrestationFormProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initialData;

  const form = useForm<PrestationCreateValues>({
    resolver: zodResolver(createPrestationSchema) as Resolver<PrestationCreateValues>,
    defaultValues: {
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      description: initialData?.description ?? "",
      kind: initialData?.kind ?? "one_shot",
      basePriceEur:
        initialData?.basePriceEurCents != null
          ? initialData.basePriceEurCents / 100
          : 0,
    },
  });

  function onSubmit(values: PrestationCreateValues): void {
    startTransition(async () => {
      const result = isEdit
        ? await updatePrestationAction(initialData!.id, values)
        : await createPrestationAction(values);
      if (toastResult(result, isEdit ? "Prestation mise à jour" : "Prestation créée")) {
        router.push("/admin/prestations");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl>
                <Input {...field} data-testid="prestation-name-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug</FormLabel>
              <FormControl>
                <Input {...field} data-testid="prestation-slug-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea {...field} data-testid="prestation-description-input" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="prestation-kind-select">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="basePriceEur"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prix de base (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...field}
                  data-testid="prestation-baseprice-input"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={isPending}
            data-testid="prestation-form-submit"
          >
            {isPending
              ? isEdit
                ? "Enregistrement..."
                : "Création..."
              : isEdit
                ? "Enregistrer"
                : "Créer"}
          </Button>
          {isEdit && initialData && (
            <ArchivePrestationButton
              id={initialData.id}
              prestationName={initialData.name}
            />
          )}
        </div>
      </form>
    </Form>
  );
}
