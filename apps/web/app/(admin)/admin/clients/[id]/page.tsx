import { notFound } from "next/navigation";
import { getClientByIdAction } from "@/app/actions/clients";
import { ClientForm } from "../_components/ClientForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getClientByIdAction(id);
  if (!result.ok || !result.data) notFound();

  return <ClientForm initialData={result.data} />;
}
