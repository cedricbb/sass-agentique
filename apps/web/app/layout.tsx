import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS Agentique",
  description: "AI-powered multi-tenant SaaS platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-background text-foreground font-sans antialiased">{children}</body>
    </html>
  );
}
