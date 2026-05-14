import { notFound } from "next/navigation";
import { getPrestationById } from "@saas/services";
import { PrestationForm } from "../_components/PrestationForm";

export const metadata = {
  title: "Modifier la prestation — Admin",
};

export default async function EditPrestationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prestation = await getPrestationById(id);
  if (!prestation) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Modifier la prestation
      </h1>
      <PrestationForm initialData={prestation} />
    </div>
  );
}
