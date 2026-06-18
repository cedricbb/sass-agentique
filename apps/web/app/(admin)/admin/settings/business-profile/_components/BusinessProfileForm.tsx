"use client";

import * as React from "react";
import { useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessProfile } from "@saas/db";
import {
  businessProfileSchema,
  type BusinessProfileFormValues,
} from "@/lib/schemas/business-profile.schemas";
import { upsertBusinessProfileAction } from "@/app/actions/business-profile";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface BusinessProfileFormProps {
  initialProfile: BusinessProfile | null;
}

const EMPTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

function buildDefaultValues(
  initialProfile: BusinessProfile | null,
): BusinessProfileFormValues {
  if (!initialProfile) {
    return {
      name: "",
      legalForm: "",
      siret: "",
      tvaIntra: "",
      address: EMPTY_ADDRESS,
      email: "",
      phone: "",
      iban: "",
      bic: "",
    };
  }

  return {
    name: initialProfile.name ?? "",
    legalForm: initialProfile.legalForm ?? "",
    siret: initialProfile.siret ?? "",
    tvaIntra: initialProfile.tvaIntra ?? "",
    address: initialProfile.address
      ? {
          line1: initialProfile.address.line1 ?? "",
          line2: initialProfile.address.line2 ?? "",
          city: initialProfile.address.city ?? "",
          state: initialProfile.address.state ?? "",
          zip: initialProfile.address.zip ?? "",
          country: initialProfile.address.country ?? "",
        }
      : EMPTY_ADDRESS,
    email: initialProfile.email ?? "",
    phone: initialProfile.phone ?? "",
    iban: initialProfile.iban ?? "",
    bic: initialProfile.bic ?? "",
  };
}

export function BusinessProfileForm({ initialProfile }: BusinessProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<BusinessProfileFormValues>({
    resolver: zodResolver(businessProfileSchema) as Resolver<BusinessProfileFormValues>,
    defaultValues: buildDefaultValues(initialProfile),
  });

  const onSubmit = (data: BusinessProfileFormValues) => {
    startTransition(async () => {
      const result = await upsertBusinessProfileAction(data);
      toastResult(result, "Profil entreprise enregistré");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Identité</legend>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Raison sociale *</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="siret"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SIRET</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="14 chiffres" />
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
                <FormLabel>N° TVA intracommunautaire</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Adresse</legend>

          <FormField
            control={form.control}
            name="address.line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ligne 1</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.line2"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ligne 2</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="address.zip"
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
              name="address.city"
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
          </div>

          <FormField
            control={form.control}
            name="address.state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Région / État</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address.country"
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
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Coordonnées</legend>

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
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-foreground">Bancaire</legend>

          <FormField
            control={form.control}
            name="iban"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IBAN</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>BIC</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <Button type="submit" disabled={isPending}>
          Enregistrer
        </Button>
      </form>
    </Form>
  );
}
