import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMembersByTenant, getInvitationsByTenant } from "@saas/services";
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
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const userRole = headersList.get("x-user-role");
  const userId = headersList.get("x-user-id");

  if (!tenantId) redirect("/login");

  const [members, invitations] = await Promise.all([
    getMembersByTenant(tenantId),
    getInvitationsByTenant(tenantId),
  ]);

  const canManage = userRole === "OWNER" || userRole === "ADMIN";
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
                  {canManage && m.role !== "OWNER" && m.userId !== userId && (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="membershipId" value={m.id} />
                      <input type="hidden" name="tenantId" value={tenantId} />
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
                <div
                  key={inv.id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">{inv.email}</p>
                    <p className="text-sm text-gray-500">{inv.role}</p>
                  </div>
                  {canManage && (
                    <form action={cancelInvitationAction}>
                      <input type="hidden" name="invitationId" value={inv.id} />
                      <input type="hidden" name="tenantId" value={tenantId} />
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Inviter un membre
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <form action={inviteMemberAction} className="flex gap-3">
                <input type="hidden" name="tenantId" value={tenantId} />
                <input type="hidden" name="invitedBy" value={userId ?? ""} />
                <input
                  type="email"
                  name="email"
                  placeholder="email@exemple.com"
                  required
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm"
                />
                <select
                  name="role"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="MEMBER">Membre</option>
                  <option value="ADMIN">Admin</option>
                  <option value="VIEWER">Lecteur</option>
                </select>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
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
