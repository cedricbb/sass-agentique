"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: undefined, label: "Tous" },
  { value: "pending", label: "En attente" },
  { value: "running", label: "En cours" },
  { value: "completed", label: "Terminé" },
  { value: "failed", label: "Échoué" },
];

interface AgentTaskStatusFilterProps {
  currentStatus?: string;
}

export function AgentTaskStatusFilter({ currentStatus }: AgentTaskStatusFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleClick(status?: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
      {STATUSES.map((s) => (
        <button
          key={s.value ?? "all"}
          onClick={() => handleClick(s.value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            (s.value === undefined && !currentStatus) ||
              s.value === currentStatus
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
