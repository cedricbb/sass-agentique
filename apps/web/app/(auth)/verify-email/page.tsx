import Link from "next/link";
import { verifyEmailAction } from "../../actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            SaaS Agentique<span className="text-amber-500 ml-1">·</span>
          </CardTitle>
          <CardDescription>Vérification de l&apos;email</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>Lien invalide</AlertTitle>
            <AlertDescription>
              Le lien de vérification est manquant ou invalide.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const result = await verifyEmailAction(token);

  if ("error" in result) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            SaaS Agentique<span className="text-amber-500 ml-1">·</span>
          </CardTitle>
          <CardDescription>Vérification de l&apos;email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Vérification échouée</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/register">Créer un nouveau compte</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          SaaS Agentique<span className="text-amber-500 ml-1">·</span>
        </CardTitle>
        <CardDescription>Vérification de l&apos;email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-green-500 text-green-700 [&>svg]:text-green-600">
          <AlertTitle>Email vérifié !</AlertTitle>
          <AlertDescription>
            Votre adresse email a bien été vérifiée.
          </AlertDescription>
        </Alert>
        <Button asChild className="w-full">
          <Link href="/login">Se connecter</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
