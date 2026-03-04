import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="font-semibold text-sm">SaaS Agentique</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight">
              SaaS Agentique
            </h1>
            <p className="text-xl text-muted-foreground max-w-lg mx-auto">
              La plateforme d&apos;agents IA pour vos équipes. Automatisez,
              collaborez et scalez avec des agents intelligents.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/register">Créer un compte</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Se connecter</Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Déjà plus de{" "}
            <span className="font-medium text-foreground">500 équipes</span>{" "}
            font confiance à SaaS Agentique.
          </p>
        </div>
      </main>
    </div>
  );
}
