import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, listTenantsByUser } from "@saas/services";
import { createWorkspaceAction } from "../../actions/onboarding";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("session-token")?.value;

  if (!sessionToken) redirect("/login");

  const user = await validateSession(sessionToken);
  if (!user) redirect("/login");

  // Si l'utilisateur a déjà un tenant, le rediriger directement
  const existingTenants = await listTenantsByUser(user.id);
  if (existingTenants.length > 0) {
    redirect(`/${existingTenants[0].slug}/dashboard`);
  }

  const { error } = await searchParams;

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Créer votre espace</CardTitle>
            <CardDescription>
              Donnez un nom à votre espace de travail.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error === "name" && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>
                  Le nom doit contenir au moins 2 caractères.
                </AlertDescription>
              </Alert>
            )}

            <form action={createWorkspaceAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom de l&apos;espace</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  minLength={2}
                  placeholder="Mon entreprise"
                />
              </div>
              <Button type="submit" className="w-full">
                Créer l&apos;espace
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
