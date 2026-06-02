"use client";

import { useState, useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { CustomerSidebar } from "./CustomerSidebar";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface CustomerUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
}

interface CustomerShellProps {
  user: CustomerUser;
  clientName?: string | null;
  children: ReactNode;
}

export const PAGE_TITLES: Record<string, string> = {
  account: "Accueil",
  quotes: "Mes devis",
  invoices: "Mes factures",
  reports: "Mes rapports",
  contracts: "Mes contrats",
  profile: "Mon profil",
  security: "Sécurité",
  setup: "Configuration 2FA",
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function CustomerShell({ user, clientName, children }: CustomerShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  }

  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const pageTitle = PAGE_TITLES[last] ?? "Mon compte";
  const initials = getInitials(user.name, user.email);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <CustomerSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={toggle}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </Button>

          <h1 className="hidden text-sm font-semibold sm:block">{pageTitle}</h1>
          {clientName && <span className="text-xs text-muted-foreground">Espace client — {clientName}</span>}

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title="Basculer le thème"
          >
            <Sun size={18} className="block dark:hidden" />
            <Moon size={18} className="hidden dark:block" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-auto items-center gap-2 px-2 py-1.5"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start text-left md:flex">
                  <span className="text-xs font-medium leading-tight">
                    {user.name ?? user.email.split("@")[0]}
                  </span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name ?? "Mon compte"}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
                <LogoutButton />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <EmailVerificationBanner emailVerified={user.emailVerified} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
