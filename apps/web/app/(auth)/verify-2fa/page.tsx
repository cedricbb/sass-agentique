import { TotpVerifyForm } from "../../../components/auth/TotpVerifyForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function Verify2FAPage({ searchParams }: Props) {
  const { next } = await searchParams;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          SaaS Agentique<span className="text-amber-500 ml-1">·</span>
        </CardTitle>
        <CardDescription>
          Entrez le code depuis votre application d&apos;authentification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TotpVerifyForm next={next} />
      </CardContent>
    </Card>
  );
}
