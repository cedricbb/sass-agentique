import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "SaaS Agentique",
  description: "AI-powered multi-tenant SaaS platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased">
        <NuqsAdapter>
          <ThemeProvider>{children}</ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
