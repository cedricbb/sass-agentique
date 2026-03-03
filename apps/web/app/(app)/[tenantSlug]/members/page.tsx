import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  validateSession,
  getTenantBySlug,
  getUserRole,
  getMembersByTenant,
  getInvitationsByTenant,
} from "@saas/services";
import {
  inviteMemberAction,
  cancelInvitationAction,
  removeMemberAction,
} from "../../../actions/tenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

function RoleBadge({ role }: { role: Role }) {
  if (role === "OWNER") {
    return (
      <Badge className="bg-primary text-primary-foreground">{role}</Badge>
    );
  }
  if (role === "ADMIN") {
    return <Badge>{role}</Badge>;
  }
  return <Badge variant="secondary">{role}</Badge>;
}

export default async function MembersPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) redirect("/");

  const userRole = await getUserRole(user.id, tenant.id);
  if (!userRole) redirect("/");

  const [members, invitations] = await Promise.all([
    getMembersByTenant(tenant.id),
    getInvitationsByTenant(tenant.id),
  ]);

  const canManage = userRole === "OWNER" || userRole === "ADMIN";
  const canInvite = canManage && user.emailVerified;
  const pendingInvitations = invitations.filter((inv) => inv.status === "PENDING");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-sm">SaaS Agentique</span>
            <nav className="flex items-center gap-1">
              <Link
                href={`/${tenantSlug}/dashboard`}
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-md hover:bg-muted/50"
              >
                Dashboard
              </Link>
              <Link
                href={`/${tenantSlug}/members`}
                className="text-foreground font-medium text-sm px-3 py-1.5 rounded-md bg-muted"
              >
                Membres
              </Link>
              <Link
                href={`/${tenantSlug}/settings/security`}
                className="text-muted-foreground hover:text-foreground text-sm px-3 py-1.5 rounded-md hover:bg-muted/50"
              >
                Sécurité
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <RoleBadge role={userRole as Role} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Membres ({members.length})</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(m.name ?? null, m.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{m.name ?? m.email}</p>
                      <p className="text-sm text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={m.role as Role} />
                    {canManage && m.role !== "OWNER" && m.userId !== user.id && (
                      <form action={removeMemberAction}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          Retirer
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {pendingInvitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Invitations en attente ({pendingInvitations.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="divide-y">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-sm">{inv.email}</p>
                      <p className="text-sm text-muted-foreground">{inv.role}</p>
                    </div>
                    {canManage && (
                      <form action={cancelInvitationAction}>
                        <input type="hidden" name="invitationId" value={inv.id} />
                        <input type="hidden" name="tenantId" value={tenant.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          Annuler
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Inviter un membre</CardTitle>
            </CardHeader>
            <CardContent>
              {!user.emailVerified && (
                <Alert className="mb-4">
                  <AlertDescription className="text-amber-700">
                    Vérifiez votre email pour pouvoir inviter des membres.
                  </AlertDescription>
                </Alert>
              )}
              <form
                action={inviteMemberAction}
                className={`space-y-4 ${!canInvite ? "opacity-50 pointer-events-none" : ""}`}
              >
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="invitedBy" value={user.id} />
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-email">Adresse email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      name="email"
                      placeholder="email@exemple.com"
                      required
                      disabled={!canInvite}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Rôle</Label>
                    <select
                      id="invite-role"
                      name="role"
                      disabled={!canInvite}
                      className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="MEMBER">Membre</option>
                      <option value="ADMIN">Admin</option>
                      <option value="VIEWER">Lecteur</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={!canInvite}>
                  Inviter
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
