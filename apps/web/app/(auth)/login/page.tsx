import { LoginForm } from "../../../components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          Connexion
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Entrez vos identifiants pour accéder à votre espace
        </p>
      </div>
      <LoginForm next={next} resetSuccess={reset === "success"} />
    </div>
  );
}
