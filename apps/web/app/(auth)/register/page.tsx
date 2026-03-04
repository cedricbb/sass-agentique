import { RegisterForm } from "../../../components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Créer un compte
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Inscrivez-vous gratuitement, sans carte bancaire
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
