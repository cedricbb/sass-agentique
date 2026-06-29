"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition, useEffect } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Client } from "@saas/db";
import { createClientSchema } from "@/lib/schemas/client.schemas";
import { createClientAction, updateClientAction } from "@/app/actions/clients";
import { toastResult } from "@/lib/toast";
import { DeleteClientButton } from "./DeleteClientButton";
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

type FormValues = z.infer<typeof createClientSchema>;

interface ClientFormProps {
  initialData?: Client;
}

export function ClientForm({ initialData }: ClientFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(createClientSchema) as Resolver<FormValues>,
    defaultValues: {
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      type: initialData?.type ?? "company",
      email: initialData?.email ?? "",
      phone: initialData?.phone ?? "",
      billingAddress: {
        line1: initialData?.billingAddress?.line1 ?? "",
        line2: initialData?.billingAddress?.line2 ?? "",
        city: initialData?.billingAddress?.city ?? "",
        state: initialData?.billingAddress?.state ?? "",
        zip: initialData?.billingAddress?.zip ?? "",
        country: initialData?.billingAddress?.country ?? "",
      },
      notes: initialData?.notes ?? "",
      siret: initialData?.siret ?? "",
      tvaIntra: initialData?.tvaIntra ?? "",
      legalForm: initialData?.legalForm ?? "",
    },
  });

  const clientType = form.watch("type");

  useEffect(() => {
    if (clientType !== "company") {
      form.setValue("siret", "");
      form.setValue("tvaIntra", "");
      form.setValue("legalForm", "");
    }
  }, [clientType, form]);

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const payload =
        data.type !== "company"
          ? { ...data, siret: null, tvaIntra: null, legalForm: null }
          : data;
      const result = initialData
        ? await updateClientAction(initialData.id, payload)
        : await createClientAction(payload);
      if (toastResult(result, initialData ? "Client mis à jour" : "Client créé")) {
        router.push("/admin/clients");
      }
    });
  };

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
                <Input {...field} />
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
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="company">Entreprise</SelectItem>
                  <SelectItem value="individual">Particulier</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {clientType === "company" && (
          <>
            <FormField
              control={form.control}
              name="siret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SIRET</FormLabel>
                  <FormControl>
                    <Input data-testid="siret-input" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tvaIntra"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TVA Intracommunautaire</FormLabel>
                  <FormControl>
                    <Input data-testid="tvaIntra-input" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legalForm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forme juridique</FormLabel>
                  <FormControl>
                    <Input data-testid="legalForm-input" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Téléphone</FormLabel>
              <FormControl>
                <Input type="tel" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.line1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse ligne 1</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.line2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse ligne 2</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ville</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>État / Région</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.zip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Code postal</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingAddress.country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pays</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isPending}>
            {initialData ? "Mettre à jour" : "Créer"}
          </Button>
          {initialData && <DeleteClientButton clientId={initialData.id} clientName={initialData.name} />}
        </div>
      </form>
    </Form>
  );
}
