import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PortalInvitationHelpPage() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          SaaS Agentique<span className="text-amber-500 ml-1">·</span>
        </CardTitle>
        <CardDescription>Accès au portail client</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Votre lien d&apos;invitation a expiré ou n&apos;est plus valide.
        </p>
        <p className="text-sm text-muted-foreground">
          Pour recevoir une nouvelle invitation, contactez l&apos;administrateur
          de votre espace client. Il pourra vous envoyer un nouveau lien d&apos;accès.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button asChild variant="outline">
          <Link href="/login">Retour à la connexion</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
