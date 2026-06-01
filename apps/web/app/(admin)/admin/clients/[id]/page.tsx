import { notFound } from "next/navigation";
import { getClientByIdAction } from "@/app/actions/clients";
import { ClientForm } from "../_components/ClientForm";
import { InviteCustomerDialog } from "../_components/InviteCustomerDialog";
import {
  listClientContacts,
  getClientContactWithUser,
  getActiveInvitationByContact,
} from "@saas/services";

const portalStatusLabel = (expiresAt: Date): string => {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(expiresAt);
  return `Invitation en cours, expire le ${formatted}`;
};

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getClientByIdAction(id);
  if (!result.ok || !result.data) notFound();

  const contacts = await listClientContacts(id);
  const contactsWithData = await Promise.all(
    contacts.map(async (contact) => {
      const [withUser, activeInvitation] = await Promise.all([
        getClientContactWithUser(contact.id),
        getActiveInvitationByContact(contact.id),
      ]);
      return { contact, user: withUser?.user ?? null, activeInvitation };
    }),
  );

  return (
    <div className="space-y-8">
      <ClientForm initialData={result.data} />
      <section>
        <h2 className="text-lg font-semibold mb-4">Accès portail</h2>
        {contactsWithData.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun contact associé à ce client.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Nom</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Rôle</th>
                <th className="text-left p-2">Statut portail</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {contactsWithData.map(({ contact, user, activeInvitation }) => (
                <tr key={contact.id} className="border-b">
                  <td className="p-2">{user?.name ?? "—"}</td>
                  <td className="p-2">{user?.email ?? "—"}</td>
                  <td className="p-2">{contact.role ?? "—"}</td>
                  <td className="p-2">
                    {activeInvitation
                      ? portalStatusLabel(activeInvitation.expiresAt)
                      : "À inviter"}
                  </td>
                  <td className="p-2">
                    {user && (
                      <InviteCustomerDialog
                        clientId={id}
                        contactId={contact.id}
                        contactName={user.name ?? user.email}
                        contactEmail={user.email}
                        hasActiveInvitation={!!activeInvitation}
                        activeExpiresAt={activeInvitation?.expiresAt}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
