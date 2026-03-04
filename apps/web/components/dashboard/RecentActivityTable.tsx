import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityItem {
  id: string;
  agent: string;
  action: string;
  status: "success" | "pending" | "error";
  duration: string;
  date: string;
}

const mockActivity: ActivityItem[] = [
  { id: "1", agent: "Agent SEO", action: "Analyse de contenu", status: "success", duration: "2.3s", date: "Il y a 2 min" },
  { id: "2", agent: "Agent Email", action: "Campagne newsletter", status: "pending", duration: "—", date: "Il y a 5 min" },
  { id: "3", agent: "Agent Data", action: "Extraction CSV", status: "success", duration: "8.1s", date: "Il y a 12 min" },
  { id: "4", agent: "Agent SEO", action: "Génération méta-tags", status: "error", duration: "1.2s", date: "Il y a 18 min" },
  { id: "5", agent: "Agent Slack", action: "Notification équipe", status: "success", duration: "0.4s", date: "Il y a 25 min" },
  { id: "6", agent: "Agent Data", action: "Rapport analytics", status: "success", duration: "15.7s", date: "Il y a 34 min" },
  { id: "7", agent: "Agent Email", action: "Relance prospects", status: "pending", duration: "—", date: "Il y a 41 min" },
];

const statusConfig: Record<ActivityItem["status"], { label: string; className: string }> = {
  success: { label: "Succès", className: "bg-emerald-100 text-emerald-700" },
  pending: { label: "En cours", className: "bg-amber-100 text-amber-700" },
  error: { label: "Erreur", className: "bg-red-100 text-red-700" },
};

function AgentAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold shrink-0">
      {name.charAt(0)}
    </span>
  );
}

export function RecentActivityTable() {
  return (
    <Card className="py-0">
      <CardHeader className="px-6 py-5 border-b">
        <CardTitle className="text-base font-semibold">Activité Récente</CardTitle>
        <CardDescription>Dernières tâches exécutées par vos agents</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b">
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Durée
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockActivity.map((item) => {
                const status = statusConfig[item.status];
                return (
                  <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <AgentAvatar name={item.agent} />
                        <span className="font-medium text-foreground">{item.agent}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.action}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                      {item.duration}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs whitespace-nowrap">
                      {item.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
