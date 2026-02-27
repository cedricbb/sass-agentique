import Link from "next/link";
import { verifyEmailAction } from "../../actions/auth";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lien invalide</h2>
        <p className="text-sm text-gray-500">
          Le lien de vérification est manquant ou invalide.
        </p>
      </>
    );
  }

  const result = await verifyEmailAction(token);

  if ("error" in result) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Vérification échouée</h2>
        <p className="text-sm text-red-600 mb-6">{result.error}</p>
        <Link
          href="/register"
          className="block text-center py-2 px-4 bg-blue-600 text-white font-medium rounded-lg text-sm"
        >
          Créer un nouveau compte
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Email vérifié !</h2>
        <p className="text-sm text-gray-500 mb-6">
          Votre adresse email a bien été vérifiée.
        </p>
        <Link
          href="/login"
          className="block text-center py-2 px-4 bg-blue-600 text-white font-medium rounded-lg text-sm"
        >
          Se connecter
        </Link>
      </div>
    </>
  );
}
