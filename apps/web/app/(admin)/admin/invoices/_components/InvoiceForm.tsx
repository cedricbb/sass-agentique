"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Client, ClientContact, Project, Quote, Invoice } from "@saas/db";
import {
  createInvoiceAction,
  createInvoiceFromQuoteAction,
  updateInvoiceAction,
} from "@/app/actions/invoices";
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
const NONE_QUOTE_VALUE = "none";
const NONE_CONTACT_VALUE = "none";

const bpsToPercent = (bps: number) => bps / 100;
const percentToBps = (pct: number) => Math.round(pct * 100);

const baseFormSchema = z.object({
  projectId: z.string().optional(),
  quoteId: z.string().optional(),
  contactId: z.string().optional(),
  dueAt: z.string().optional(),
  vatRatePercent: z.coerce.number().min(0).max(100),
  notes: z.string().optional(),
});

const createFormSchema = baseFormSchema.extend({
  clientId: z.string().min(1, "Sélectionner un client"),
});

type FormValues = z.infer<typeof createFormSchema>;

interface InvoiceFormProps {
  initialData?: Invoice;
  clients: Client[];
  projects: Project[];
  contacts?: ClientContact[];
  acceptedQuotes?: Quote[];
  sourceQuote?: Quote | null;
  mode: "create" | "edit";
}

export function InvoiceForm({
  initialData,
  clients,
  projects,
  contacts,
  acceptedQuotes,
  sourceQuote,
  mode,
}: InvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quoteSelected, setQuoteSelected] = useState(false);

  const isDraft = initialData?.status === "draft";

  const form = useForm<FormValues>({
    resolver: zodResolver(
      mode === "create" ? createFormSchema : baseFormSchema,
    ) as unknown as Resolver<FormValues>,
    defaultValues: {
      clientId: "",
      projectId: initialData?.projectId ?? NONE_PROJECT_VALUE,
      quoteId: NONE_QUOTE_VALUE,
      contactId: initialData?.contactId ?? NONE_CONTACT_VALUE,
      dueAt: initialData?.dueAt
        ? new Date(initialData.dueAt).toISOString().split("T")[0]
        : undefined,
      vatRatePercent: bpsToPercent(initialData?.vatRateBps ?? DEFAULT_VAT_BPS),
      notes: initialData?.notes ?? "",
    },
  });

  const watchedClientId = form.watch("clientId");

  const onSubmit = (data: FormValues) => {
    startTransition(async () => {
      if (mode === "create") {
        if (data.quoteId && data.quoteId !== NONE_QUOTE_VALUE) {
          const result = await createInvoiceFromQuoteAction({ quoteId: data.quoteId });
          if (toastResult(result, "Facture créée depuis le devis")) {
            router.push("/admin/invoices");
          }
        } else {
          const projectId =
            data.projectId === NONE_PROJECT_VALUE ? undefined : data.projectId;
          const contactId =
            data.contactId === NONE_CONTACT_VALUE ? undefined : data.contactId;
          const dueAt = data.dueAt ? new Date(data.dueAt) : undefined;
          const vatRateBps = percentToBps(data.vatRatePercent);
          const result = await createInvoiceAction({
            clientId: data.clientId!,
            projectId,
            contactId,
            dueAt,
            vatRateBps,
            notes: data.notes,
          });
          if (toastResult(result, "Facture créée")) {
            router.push("/admin/invoices");
          }
        }
      } else {
        const dueAt = data.dueAt ? new Date(data.dueAt) : null;
        const notes = data.notes || null;
        const contactId =
          data.contactId === NONE_CONTACT_VALUE ? null : data.contactId;
        const patch: Record<string, unknown> = { dueAt, notes, contactId };

        if (isDraft) {
          patch.projectId =
            data.projectId === NONE_PROJECT_VALUE ? null : data.projectId;
          patch.vatRateBps = percentToBps(data.vatRatePercent);
        }

        const result = await updateInvoiceAction(initialData!.id, patch);
        if (toastResult(result, "Facture mise à jour")) {
          router.push("/admin/invoices");
        }
      }
    });
  };

  function handleQuoteChange(value: string) {
    form.setValue("quoteId", value);
    setQuoteSelected(value !== NONE_QUOTE_VALUE);
  }

  function handleClientChange(value: string, fieldOnChange: (v: string) => void) {
    fieldOnChange(value);
    form.setValue("contactId", NONE_CONTACT_VALUE);
  }

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
                <Select
                  onValueChange={(v) => handleClientChange(v, field.onChange)}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger data-testid="invoice-clientId-select">
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
              data-testid="invoice-clientId-lock-hint"
            >
              Le client ne peut pas être changé
            </p>
          </div>
        )}

        {mode === "create"
          ? watchedClientId && !quoteSelected && (
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinataire (contact)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? NONE_CONTACT_VALUE}>
                      <FormControl>
                        <SelectTrigger data-testid="invoice-contactId-select">
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
                      <SelectTrigger data-testid="invoice-contactId-select">
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

        {mode === "create" ? (
          <FormField
            control={form.control}
            name="quoteId"
            render={() => (
              <FormItem>
                <FormLabel>Devis source</FormLabel>
                <Select
                  onValueChange={handleQuoteChange}
                  defaultValue={NONE_QUOTE_VALUE}
                >
                  <FormControl>
                    <SelectTrigger data-testid="invoice-quoteId-select">
                      <SelectValue placeholder="Aucun devis source" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_QUOTE_VALUE}>Aucun devis source</SelectItem>
                    {acceptedQuotes?.map((q) => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {quoteSelected && (
                  <p className="text-sm text-muted-foreground" data-testid="invoice-quote-source-hint">
                    Les champs seront repris depuis le devis
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ) : sourceQuote ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">Devis source</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="invoice-quote-source-display"
            >
              Issu du devis {sourceQuote.number}
            </p>
          </div>
        ) : null}

        {mode === "create" || (mode === "edit" && isDraft) ? (
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Projet</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value ?? NONE_PROJECT_VALUE}
                  disabled={quoteSelected}
                >
                  <FormControl>
                    <SelectTrigger data-testid="invoice-projectId-select" disabled={quoteSelected}>
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
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Projet</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="invoice-projectId-lock-hint"
            >
              Le projet ne peut pas être changé
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="dueAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{"Date d'échéance"}</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  data-testid="invoice-dueAt-input"
                  disabled={quoteSelected}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "create" || (mode === "edit" && isDraft) ? (
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
                    data-testid="invoice-vatRate-input"
                    disabled={quoteSelected}
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">Taux TVA (%)</p>
            <p
              className="text-sm text-muted-foreground"
              data-testid="invoice-vatRate-lock-hint"
            >
              Le taux TVA ne peut pas être changé
            </p>
          </div>
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  data-testid="invoice-notes-input"
                  disabled={quoteSelected}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} data-testid="invoice-submit">
          {mode === "create" ? "Créer la facture" : "Enregistrer"}
        </Button>
      </form>
    </Form>
  );
}
