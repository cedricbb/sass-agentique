import { LoginForm } from "../../../components/auth/LoginForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  searchParams: Promise<{ next?: string; reset?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, reset } = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          SaaS Agentique<span className="text-amber-500 ml-1">·</span>
        </CardTitle>
        <CardDescription>Connectez-vous à votre espace</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} resetSuccess={reset === "success"} />
      </CardContent>
    </Card>
  );
}
