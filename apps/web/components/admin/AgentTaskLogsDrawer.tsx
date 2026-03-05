"use client";

import { useState } from "react";
import { Logs, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  level: string;
  message: string;
  createdAt: string;
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-amber-400",
  error: "text-red-400",
  debug: "text-slate-400",
};

interface AgentTaskLogsDrawerProps {
  taskId: string;
}

export function AgentTaskLogsDrawer({ taskId }: AgentTaskLogsDrawerProps) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadLogs() {
    if (logs !== null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/agent-tasks/${taskId}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
      } else {
        setLogs([]);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={loadLogs}>
          <Logs className="mr-1.5 size-3.5" />
          Logs
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[480px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">
            Logs — {taskId.slice(0, 8)}…
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 h-[calc(100vh-120px)] overflow-y-auto rounded-lg bg-slate-950 p-4">
          {loading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Chargement…
            </div>
          )}
          {!loading && logs?.length === 0 && (
            <p className="text-slate-500 text-sm">Aucun log disponible.</p>
          )}
          {!loading && logs && logs.length > 0 && (
            <ul className="space-y-1">
              {logs.map((log) => (
                <li key={log.id} className="font-mono text-xs leading-relaxed">
                  <span className="text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString("fr-FR")}
                  </span>{" "}
                  <span
                    className={cn(
                      "font-semibold uppercase",
                      LEVEL_STYLES[log.level] ?? "text-slate-300",
                    )}
                  >
                    [{log.level}]
                  </span>{" "}
                  <span className="text-slate-200">{log.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
