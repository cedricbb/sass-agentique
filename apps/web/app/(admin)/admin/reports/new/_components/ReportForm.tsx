"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadAndCreateReportAction } from "@/app/actions/reports";
import { toastResult } from "@/lib/toast";
import type { Client, Project } from "@saas/db";

type ReportKind = "delivery" | "monthly" | "audit" | "other";

const KIND_OPTIONS: { value: ReportKind; label: string }[] = [
  { value: "delivery", label: "Livraison" },
  { value: "monthly", label: "Mensuel" },
  { value: "audit", label: "Audit" },
  { value: "other", label: "Autre" },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ReportFormProps = { clients: Client[]; projects: Project[] };

export function ReportForm({ clients, projects }: ReportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ReportKind>("delivery");
  const [summary, setSummary] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const filteredProjects = projects.filter((p) => p.clientId === clientId);

  function handleFileChange(fileList: FileList | null) {
    setFileError(null);
    if (!fileList || fileList.length === 0) {
      setFile(null);
      return;
    }
    const selectedFile = fileList[0];
    if (selectedFile.type !== "application/pdf") {
      setFileError("Le fichier doit être un PDF.");
      setFile(null);
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFileError("Le fichier dépasse 10 Mo.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  }

  function validateForm(): boolean {
    let hasError = false;
    if (!file) {
      setFileError("Veuillez sélectionner un fichier PDF.");
      hasError = true;
    }
    if (!clientId) {
      setClientError("Sélectionnez un client.");
      hasError = true;
    }
    if (!title.trim()) {
      setTitleError("Le titre est requis.");
      hasError = true;
    }
    return !hasError;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    const fd = new FormData();
    fd.append("file", file!);
    fd.append("clientId", clientId);
    fd.append("title", title);
    fd.append("kind", kind);
    if (projectId) fd.append("projectId", projectId);
    if (summary) fd.append("summary", summary);

    startTransition(async () => {
      const result = await uploadAndCreateReportAction(fd);
      if (toastResult(result, "Rapport créé.")) {
        router.push(`/admin/reports/${result.data.id}`);
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-2">
        <Label htmlFor="report-file">Fichier PDF</Label>
        <Input
          id="report-file"
          type="file"
          accept="application/pdf"
          data-testid="report-file-input"
          onChange={(e) => handleFileChange(e.target.files)}
        />
        {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      </div>

      <div className="space-y-2">
        <Label>Client</Label>
        <Select
          value={clientId}
          onValueChange={(v) => {
            setClientId(v);
            setClientError(null);
            setProjectId("");
          }}
        >
          <SelectTrigger data-testid="report-client-select">
            <SelectValue placeholder="Sélectionnez un client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clientError && <p className="text-sm text-destructive">{clientError}</p>}
      </div>

      <div className="space-y-2">
        <Label>Projet (optionnel)</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger data-testid="report-project-select">
            <SelectValue placeholder="Aucun projet" />
          </SelectTrigger>
          <SelectContent>
            {filteredProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-title">Titre</Label>
        <Input
          id="report-title"
          data-testid="report-title-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleError(null);
          }}
          placeholder="Titre du rapport"
        />
        {titleError && <p className="text-sm text-destructive">{titleError}</p>}
      </div>

      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as ReportKind)}>
          <SelectTrigger data-testid="report-kind-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="report-summary">Résumé (optionnel)</Label>
        <Textarea
          id="report-summary"
          data-testid="report-summary-input"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Résumé du rapport"
          rows={4}
        />
      </div>

      <Button
        data-testid="report-form-submit"
        disabled={isPending || !file || !clientId || !title}
        onClick={handleSubmit}
      >
        {isPending ? "Envoi en cours…" : "Créer le rapport"}
      </Button>
    </div>
  );
}
