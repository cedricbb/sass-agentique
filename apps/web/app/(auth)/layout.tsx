import type { ReactNode } from "react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left panel — form */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950">
        {/* Back link */}
        <div className="flex justify-start p-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Accueil
          </Link>
        </div>

        {/* Form container */}
        <div className="flex-1 flex items-center justify-center px-8 pb-16">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>

      {/* Right panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gray-900 flex-col justify-between p-12 overflow-hidden">
        {/* Dot grid background */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot-grid)" />
        </svg>

        {/* Glow accents */}
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="text-white font-bold text-sm">SA</span>
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">
            SaaS Agentique
          </span>
        </Link>

        {/* Tagline */}
        <div className="relative z-10 space-y-6">
          <div className="h-px w-12 bg-amber-500" />
          <blockquote className="space-y-3">
            <p className="text-white text-2xl font-medium leading-relaxed">
              Orchestrez vos agents IA, automatisez vos workflows et gérez vos équipes depuis une seule plateforme.
            </p>
            <footer className="text-gray-400 text-sm flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              Multi-tenant · Agents IA · Workflows · RBAC
            </footer>
          </blockquote>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-gray-600 text-sm">
          © {new Date().getFullYear()} SaaS Agentique
        </p>
      </div>

    </div>
  );
}
