import Link from "next/link";
import { ResetPasswordForm } from "../../../components/auth/ResetPasswordForm";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lien invalide</h2>
        <p className="text-sm text-gray-500 mb-6">
          Ce lien de réinitialisation est invalide ou a expiré.
        </p>
        <Link
          href="/forgot-password"
          className="block text-center py-2 px-4 bg-blue-600 text-white font-medium rounded-lg text-sm"
        >
          Demander un nouveau lien
        </Link>
      </>
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Nouveau mot de passe</h2>
      <p className="text-sm text-gray-500 mb-6">
        Choisissez un nouveau mot de passe sécurisé.
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}
