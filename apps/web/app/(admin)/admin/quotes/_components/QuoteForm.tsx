"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Client, ClientContact, Project, Quote } from "@saas/db";
import { createQuoteAction, updateQuoteAction } from "@/app/actions/quotes";
import { toastResult } from "@/lib/toast";
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

const DEFAULT_VAT_BPS = 2000;
const NONE_PROJECT_VALUE = "none";
const NONE_CONTACT_VALUE = "none";

const bpsToPercent = (bps: number) => bps / 100;
const percentToBps = (pct: number) => Math.round(pct * 100);

const baseFormSchema = z.object({
  projectId: z.string().optional(),
  contactId: z.string().optional(),
  expiresAt: z.string().optional(),
  vatRatePercent: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
});

const createFormSchema = baseFormSchema.extend({
  clientId: z.string().min(1, "Sélectionner un client"),
});

type FormValues = z.infer<typeof createFormSchema>;

interface QuoteFormProps {
  initialData?: Quote;
  clients: Client[];
  projects: Project[];
  contacts?: ClientContact[];
  mode: "create" | "edit";
}

export function QuoteForm({ initialData, clients, projects, contacts, mode }: QuoteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(
      mode === "create" ? createFormSchema : baseFormSchema,
    ) as unknown as Resolver<FormValues>,
    defaultValues: {
      clientId: "",
      projectId: initialData?.projectId ?? NONE_PROJECT_VALUE,
      contactId: initialData?.contactId ?? NONE_CONTACT_VALUE,
      expiresAt: initialData?.expiresAt
        ? new Date(initialData.expiresAt).toISOString().split("T")[0]
        : undefined,
      vatRatePercent: bpsToPercent(initialData?.vatRateBps ?? DEFAULT_VAT_BPS),
      notes: initialData?.notes ?? "",
    },
  });

  const watchedClientId = form.watch("clientId");

  function handleClientChange(value: string, fieldOnChange: (v: string) => void) {
    fieldOnChange(value);
    form.setValue("contactId", NONE_CONTACT_VALUE);
  }

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      const vatRateBps = percentToBps(data.vatRatePercent);
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;

      if (mode === "create") {
        const projectId =
          data.projectId === NONE_PROJECT_VALUE ? undefined : data.projectId;
        const contactId =
          data.contactId === NONE_CONTACT_VALUE ? undefined : data.contactId;
        const result = await createQuoteAction({
          clientId: data.clientId!,
          projectId,
          contactId,
          expiresAt,
          vatRateBps,
          notes: data.notes,
        });
        if (toastResult(result, "Devis créé")) {
          router.push("/admin/quotes");
        }
      } else {
        const projectId =
          data.projectId === NONE_PROJECT_VALUE ? null : data.projectId;
        const contactId =
          data.contactId === NONE_CONTACT_VALUE ? null : data.contactId;
        const result = await updateQuoteAction(initialData!.id, {
          projectId,
          contactId,
          expiresAt: expiresAt ?? null,
          vatRateBps,
          notes: data.notes,
        });
        if (toastResult(result, "Devis mis à jour")) {
          router.push("/admin/quotes");
        }
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        {mode === "create" ? (
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select onValueChange={(v) => handleClientChange(v, field.onChange)} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="quote-clientId-select">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Client</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="quote-clientId-lock-hint"
            >
              Le client ne peut pas être changé
            </p>
          </div>
        )}

        {mode === "create"
          ? watchedClientId && (
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinataire (contact)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? NONE_CONTACT_VALUE}>
                      <FormControl>
                        <SelectTrigger data-testid="quote-contactId-select">
                          <SelectValue placeholder="Aucun (entreprise seule)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_CONTACT_VALUE}>Aucun (entreprise seule)</SelectItem>
                        {contacts
                          ?.filter((c) => c.clientId === watchedClientId)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )
          : (
            <FormField
              control={form.control}
              name="contactId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destinataire (contact)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? NONE_CONTACT_VALUE}>
                    <FormControl>
                      <SelectTrigger data-testid="quote-contactId-select">
                        <SelectValue placeholder="Aucun (entreprise seule)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE_CONTACT_VALUE}>Aucun (entreprise seule)</SelectItem>
                      {contacts
                        ?.filter((c) => c.clientId === initialData?.clientId)
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Projet</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value ?? NONE_PROJECT_VALUE}
              >
                <FormControl>
                  <SelectTrigger data-testid="quote-projectId-select">
                    <SelectValue placeholder="Aucun projet" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NONE_PROJECT_VALUE}>Aucun projet</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
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
          name="expiresAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{"Date d'expiration"}</FormLabel>
              <FormControl>
                <Input type="date" data-testid="quote-expiresAt-input" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="vatRatePercent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Taux TVA (%)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  data-testid="quote-vatRate-input"
                  {...field}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
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
                <Textarea data-testid="quote-notes-textarea" {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} data-testid="quote-submit-button">
          {mode === "create" ? "Créer le devis" : "Mettre à jour"}
        </Button>
      </form>
    </Form>
  );
}
