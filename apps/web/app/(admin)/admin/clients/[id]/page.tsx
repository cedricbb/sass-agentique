import { notFound } from "next/navigation";
import { getClientByIdAction } from "@/app/actions/clients";
import { ClientForm } from "../_components/ClientForm";
import { InviteCustomerDialog } from "../_components/InviteCustomerDialog";
import { AddClientContactDialog } from "../_components/AddClientContactDialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  listClientContacts,
  getClientContactWithUser,
  getActiveInvitationByContact,
  getLastConsumedInvitationByContact,
} from "@saas/services";

const portalStatusLabel = (expiresAt: Date): string => {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(expiresAt);
  return `Invitation en cours, expire le ${formatted}`;
};

const portalAccountCreatedLabel = (consumedAt: Date | null): string => {
  if (!consumedAt) return "Compte créé";
  const formatted = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(consumedAt);
  return `Compte créé le ${formatted}`;
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
      const [withUser, activeInvitation, lastConsumedInvitation] = await Promise.all([
        getClientContactWithUser(contact.id),
        getActiveInvitationByContact(contact.id),
        contact.userId ? getLastConsumedInvitationByContact(contact.id) : Promise.resolve(null),
      ]);
      return { contact, user: withUser?.user ?? null, activeInvitation, lastConsumedInvitation };
    }),
  );

  return (
    <div className="space-y-8">
      <ClientForm initialData={result.data} />
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Accès portail</h2>
          <AddClientContactDialog clientId={id} />
        </div>
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
              {contactsWithData.map(({ contact, user, activeInvitation, lastConsumedInvitation }) => (
                <tr key={contact.id} className="border-b">
                  <td className="p-2">{contact.name}</td>
                  <td className="p-2">{contact.email}</td>
                  <td className="p-2">{contact.role ?? "—"}</td>
                  <td className="p-2">
                    {contact.userId ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>Compte créé</TooltipTrigger>
                          <TooltipContent>
                            {user?.email}
                            {user?.name ? ` — ${user.name}` : ""}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : activeInvitation ? (
                      portalStatusLabel(activeInvitation.expiresAt)
                    ) : (
                      "À inviter"
                    )}
                  </td>
                  <td className="p-2">
                    {contact.userId ? (
                      <span className="text-muted-foreground text-sm">
                        {portalAccountCreatedLabel(lastConsumedInvitation?.consumedAt ?? null)}
                      </span>
                    ) : (
                      <InviteCustomerDialog
                        clientId={id}
                        contactId={contact.id}
                        contactName={contact.name}
                        contactEmail={contact.email}
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
