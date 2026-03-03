import Link from "next/link";
import { ResetPasswordForm } from "../../../components/auth/ResetPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            SaaS Agentique<span className="text-amber-500 ml-1">·</span>
          </CardTitle>
          <CardDescription>Réinitialisation du mot de passe</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              Ce lien de réinitialisation est invalide ou a expiré.
            </AlertDescription>
          </Alert>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Demander un nouveau lien</Link>
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
        <CardDescription>Choisissez un nouveau mot de passe sécurisé.</CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/login" className="text-primary hover:underline text-sm">
          Retour à la connexion
        </Link>
      </CardFooter>
    </Card>
  );
}
