import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession } from "@saas/services";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  User,
  ShieldCheck,
  CheckCircle,
  MapPin,
  Globe,
  Github,
  Linkedin,
  Twitter,
  Instagram,
} from "lucide-react";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";
import { SocialLinksEditButton } from "@/components/profile/SocialLinksEditButton";

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const SOCIAL_DEFS = [
  { key: "github" as const, icon: Github, label: "GitHub" },
  { key: "linkedin" as const, icon: Linkedin, label: "LinkedIn" },
  { key: "twitter" as const, icon: Twitter, label: "Twitter / X" },
  { key: "instagram" as const, icon: Instagram, label: "Instagram" },
];

export default async function AdminProfilePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;
  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user || user.role !== "admin") redirect("/admin");

  const initials = getInitials(user.name, user.email);
  const socialLinks = user.socialLinks ?? {};

  return (
    <div className="space-y-6">

      {/* ── Meta card ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">

            {/* Avatar */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
              {initials}
            </div>

            {/* Nom + rôle + localisation */}
            <div className="text-center sm:text-left">
              <h4 className="text-lg font-semibold text-foreground">
                {user.name ?? user.email.split("@")[0]}
              </h4>
              <div className="mt-1 flex flex-col items-center gap-1 sm:flex-row sm:gap-3">
                <Badge className="text-xs">Admin</Badge>
                {user.location && (
                  <>
                    <span className="hidden h-3.5 w-px bg-border sm:block" />
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin size={12} />
                      {user.location}
                    </p>
                  </>
                )}
              </div>
              {user.bio && (
                <p className="mt-2 text-sm text-muted-foreground">{user.bio}</p>
              )}
            </div>
          </div>

          {/* Icônes réseaux sociaux + bouton edit */}
          <div className="flex flex-col items-center gap-3 xl:items-end">
            <ProfileEditButton
              initialName={user.name}
              initialBio={user.bio}
              initialLocation={user.location}
              initialWebsite={user.website}
            />
            <div className="flex items-center gap-2">
              {SOCIAL_DEFS.filter(({ key }) => socialLinks[key]).map(({ key, icon: Icon, label }) => (
                <a
                  key={key}
                  href={socialLinks[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Informations personnelles ─────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h4 className="text-lg font-semibold text-foreground">Informations personnelles</h4>
          <ProfileEditButton
            initialName={user.name}
            initialBio={user.bio}
            initialLocation={user.location}
            initialWebsite={user.website}
          />
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
              <CheckCircle size={16} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vérification email</p>
              <p className="mt-0.5 text-sm font-medium text-emerald-600">Vérifié</p>
            </div>
          </div>

          {user.website && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Globe size={16} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Site web</p>
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 text-sm font-medium text-primary hover:underline"
                >
                  {user.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Réseaux sociaux ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 lg:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h4 className="text-lg font-semibold text-foreground">Réseaux sociaux</h4>
          <SocialLinksEditButton initialLinks={user.socialLinks} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_DEFS.map(({ key, icon: Icon, label }) => {
            const href = socialLinks[key];
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon size={16} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-sm font-medium text-primary hover:underline"
                    >
                      {href.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm text-muted-foreground italic">Non renseigné</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
