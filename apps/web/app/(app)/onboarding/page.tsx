import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, listTenantsByUser } from "@saas/services";
import { createWorkspaceAction } from "../../actions/onboarding";

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Créer votre espace
        </h1>
        <p className="text-gray-500 mb-6">
          Donnez un nom à votre espace de travail.
        </p>

        {error === "name" && (
          <p className="text-sm text-red-600 mb-4">
            Le nom doit contenir au moins 2 caractères.
          </p>
        )}

        <form action={createWorkspaceAction} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nom de l&apos;espace
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={2}
              placeholder="Mon entreprise"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Créer l&apos;espace
          </button>
        </form>
      </div>
    </div>
  );
}
