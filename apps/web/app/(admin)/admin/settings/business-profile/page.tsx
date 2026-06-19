import { requireAdmin } from "@/lib/auth";
import { getBusinessProfile } from "@saas/services";
import { BusinessProfileForm } from "./_components/BusinessProfileForm";
import { BusinessProfileLogo } from "./_components/BusinessProfileLogo";

export default async function BusinessProfileSettingsPage() {
  const user = await requireAdmin();
  const profile = await getBusinessProfile(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Profil entreprise</h2>
        <p className="text-muted-foreground">
          Renseignez l&apos;identité de votre structure (raison sociale, SIRET, adresse, coordonnées bancaires).
        </p>
      </div>
      <BusinessProfileLogo
        hasLogo={profile?.logoKey != null}
        version={profile?.updatedAt?.toISOString() ?? ""}
      />
      <BusinessProfileForm initialProfile={profile} />
    </div>
  );
}
