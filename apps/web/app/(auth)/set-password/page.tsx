import Link from "next/link";
import { getInvitationByToken, userExistsByEmail } from "@saas/services";
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
import { PasswordSetupForm } from "@/components/auth/PasswordSetupForm";
import { LinkAccountForm } from "@/components/auth/LinkAccountForm";
import { setInitialPasswordAction, linkExistingAccountAction } from "@/app/actions/auth";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

const INVALID_LINK_CARD = (
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle className="text-2xl">
        SaaS Agentique<span className="text-amber-500 ml-1">·</span>
      </CardTitle>
      <CardDescription>Accès au portail client</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <Alert variant="destructive">
        <AlertDescription>
          Ce lien d&apos;invitation est invalide ou a expiré.
        </AlertDescription>
      </Alert>
      <Button asChild className="w-full">
        <Link href="/portal-invitation-help">Demander une nouvelle invitation</Link>
      </Button>
    </CardContent>
  </Card>
);

export default async function SetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return INVALID_LINK_CARD;
  }

  let invitationEmail: string;

  try {
    const invitation = await getInvitationByToken(token);
    invitationEmail = invitation.email.toLowerCase();
  } catch {
    return INVALID_LINK_CARD;
  }

  const hasExistingAccount = await userExistsByEmail(invitationEmail);

  if (hasExistingAccount) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">
            SaaS Agentique<span className="text-amber-500 ml-1">·</span>
          </CardTitle>
          <CardDescription>Lier votre compte existant</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Vous avez déjà un compte chez nous. Votre mot de passe actuel reste inchangé.
          </p>
          <LinkAccountForm token={token} action={linkExistingAccountAction} />
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" className="text-primary hover:underline text-sm">
            Me connecter d&apos;abord
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          SaaS Agentique<span className="text-amber-500 ml-1">·</span>
        </CardTitle>
        <CardDescription>Créez votre mot de passe pour accéder au portail.</CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordSetupForm
          token={token}
          action={setInitialPasswordAction}
          submitLabel="Créer mon mot de passe"
          pendingLabel="Création en cours…"
        />
      </CardContent>
    </Card>
  );
}