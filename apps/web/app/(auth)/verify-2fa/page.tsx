import { TotpVerifyForm } from "../../../components/auth/TotpVerifyForm";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function Verify2FAPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Vérification en deux étapes
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Entrez le code depuis votre application d&apos;authentification.
      </p>
      <TotpVerifyForm next={next} />
    </>
  );
}
