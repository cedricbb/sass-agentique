import { PrestationForm } from "../_components/PrestationForm";

export const metadata = {
  title: "Nouvelle prestation — Admin",
};

export default function NewPrestationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Nouvelle prestation
      </h1>
      <PrestationForm />
    </div>
  );
}
