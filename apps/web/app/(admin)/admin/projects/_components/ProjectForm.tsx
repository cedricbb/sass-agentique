"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Project, Client } from "@saas/db";
import { createProjectSchema, type ProjectCreateValues } from "@/lib/schemas/project.schemas";
import { createProjectAction, updateProjectAction } from "@/app/actions/projects";
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

interface ProjectFormProps {
  initialData?: Project;
  clients: Client[];
}

export function ProjectForm({ initialData, clients }: ProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = !!initialData;

  const form = useForm<ProjectCreateValues>({
    resolver: zodResolver(createProjectSchema) as Resolver<ProjectCreateValues>,
    defaultValues: {
      clientId: initialData?.clientId ?? "",
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      description: initialData?.description ?? "",
    },
  });

  const onSubmit = (data: ProjectCreateValues) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateProjectAction(initialData.id, data)
        : await createProjectAction(data);
      if (toastResult(result, isEdit ? "Projet mis à jour" : "Projet créé")) {
        router.push("/admin/projects");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField
          control={form.control}
          name="clientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="project-client-select">
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

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom</FormLabel>
              <FormControl>
                <Input data-testid="project-name-input" {...field} />
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
                <Input data-testid="project-slug-input" {...field} />
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
                <Textarea data-testid="project-description-input" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending} data-testid="project-form-submit">
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/admin/projects")}>
            Annuler
          </Button>
        </div>
      </form>
    </Form>
  );
}
