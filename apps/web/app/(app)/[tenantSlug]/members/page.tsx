import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">
            <a href={`/${tenantSlug}/dashboard`}>SaaS Agentique</a>
          </h1>
          <span className="text-sm text-gray-500">{userRole}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Membres ({members.length})
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">{m.name ?? m.email}</p>
                  <p className="text-sm text-gray-500">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-600">{m.role}</span>
                  {canManage && m.role !== "OWNER" && m.userId !== user.id && (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <button
                        type="submit"
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        Retirer
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {pendingInvitations.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Invitations en attente ({pendingInvitations.length})
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 divide-y">
              {pendingInvitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium text-gray-900">{inv.email}</p>
                    <p className="text-sm text-gray-500">{inv.role}</p>
                  </div>
                  {canManage && (
                    <form action={cancelInvitationAction}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <button
                        type="submit"
                        className="text-sm text-gray-500 hover:text-gray-900"
                      >
                        Annuler
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {canManage && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Inviter un membre</h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {!user.emailVerified && (
                <p className="text-sm text-amber-700 mb-4">
                  Vérifiez votre email pour pouvoir inviter des membres.
                </p>
              )}
              <form action={inviteMemberAction} className={`flex gap-3 ${!canInvite ? "opacity-50 pointer-events-none" : ""}`}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <input type="hidden" name="invitedBy" value={user.id} />
                <input
                  type="email"
                  name="email"
                  placeholder="email@exemple.com"
                  required
                  disabled={!canInvite}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
                />
                <select
                  name="role"
                  disabled={!canInvite}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Membre</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Lecteur</option>
                </select>
                <button
                  type="submit"
                  disabled={!canInvite}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Inviter
                </button>
              </form>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
