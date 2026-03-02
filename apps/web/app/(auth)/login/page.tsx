import { LoginForm } from "../../../components/auth/LoginForm";

type Props = {
  searchParams: Promise<{ next?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset } = await searchParams;

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>
      <LoginForm next={next} resetSuccess={reset === "success"} />
    </>
  );
}
