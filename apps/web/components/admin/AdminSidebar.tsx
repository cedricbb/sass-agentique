"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Bot,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/agent-tasks", label: "Tâches Agent", icon: Bot },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-background">
      {/* Logo / titre */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">A</span>
        </div>
        <span className="text-sm font-semibold">Admin Panel</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="ml-auto size-3.5 opacity-50" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer — lien retour app */}
      <div className="border-t border-border p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          ← Retour à l&apos;app
        </Link>
      </div>
    </aside>
  );
}
