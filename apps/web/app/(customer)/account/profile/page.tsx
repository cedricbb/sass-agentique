import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Mail, User, ShieldCheck } from "lucide-react";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  const initials = getInitials(user.name, user.email);

  return (
    <div className="space-y-6">

      {/* ── Meta card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {initials}
            </div>

            {/* Nom + email + badge */}
            <div className="text-center sm:text-left">
              <h4 className="text-lg font-semibold text-foreground">
                {user.name ?? user.email.split("@")[0]}
              </h4>
              <div className="mt-1 flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
                <p className="text-sm text-muted-foreground">{user.email}</p>
                <span className="hidden h-3.5 w-px bg-border sm:block" />
                <Badge variant={user.emailVerified ? "default" : "secondary"} className="text-xs">
                  {user.emailVerified ? "Email vérifié" : "Email non vérifié"}
                </Badge>
              </div>
            </div>
          </div>

          <ProfileEditButton initialName={user.name} />
        </div>
      </div>

      {/* ── Informations personnelles ─────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h4 className="text-lg font-semibold text-foreground">Informations personnelles</h4>
          <ProfileEditButton initialName={user.name} />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <User size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nom complet</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {user.name ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Mail size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Adresse email</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <ShieldCheck size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rôle</p>
              <p className="mt-0.5 text-sm font-medium text-foreground capitalize">
                {user.role}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              {user.emailVerified
                ? <CheckCircle size={16} className="text-emerald-500" />
                : <XCircle size={16} className="text-destructive" />
              }
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vérification email</p>
              <p className={`mt-0.5 text-sm font-medium ${user.emailVerified ? "text-emerald-600" : "text-destructive"}`}>
                {user.emailVerified ? "Vérifié" : "Non vérifié"}
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
