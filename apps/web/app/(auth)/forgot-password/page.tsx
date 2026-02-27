import { ForgotPasswordForm } from "../../../components/auth/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Mot de passe oublié</h2>
      <p className="text-sm text-gray-500 mb-6">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
