"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Bell, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useTenant } from "@/contexts/TenantContext";
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
import { logoutAction } from "@/app/actions/auth";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  members: "Membres",
  security: "Sécurité",
  setup: "Configuration 2FA",
  settings: "Paramètres",
};

function usePageTitle(): string {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  return PAGE_TITLES[last] ?? "Dashboard";
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

interface HeaderProps {
  onMenuClick: () => void;
  onToggle: () => void;
  collapsed: boolean;
}

export function Header({ onMenuClick, onToggle, collapsed }: HeaderProps) {
  const { currentUser, tenant } = useTenant();
  const title = usePageTitle();
  const initials = getInitials(currentUser.name, currentUser.email);
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 z-10">
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu size={20} />
      </Button>

      {/* Desktop sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={onToggle}
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </Button>

      {/* Page title */}
      <h1 className="hidden text-sm font-semibold sm:block">{title}</h1>

      <div className="flex-1" />

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        title="Basculer le thème"
      >
        <Sun size={18} className="block dark:hidden" />
        <Moon size={18} className="hidden dark:block" />
      </Button>

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative">
        <Bell size={18} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
      </Button>

      {/* User dropdown */}
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
                {currentUser.name ?? currentUser.email.split("@")[0]}
              </span>
              <span className="text-xs leading-tight text-muted-foreground">
                {tenant.name}
              </span>
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">
                {currentUser.name ?? "Mon compte"}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {currentUser.email}
              </span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/${tenant.slug}/settings/security`}>
              Sécurité
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            asChild
            className="text-destructive focus:text-destructive"
          >
            <form action={logoutAction} className="w-full">
              <button type="submit" className="w-full text-left">
                Déconnexion
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
