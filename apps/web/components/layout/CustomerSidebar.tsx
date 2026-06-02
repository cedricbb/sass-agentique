"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Receipt, FileBarChart, FileSignature, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Accueil", icon: Home },
  { href: "/account/quotes", label: "Mes devis", icon: FileText },
  { href: "/account/invoices", label: "Mes factures", icon: Receipt },
  { href: "/account/reports", label: "Mes rapports", icon: FileBarChart },
  { href: "/account/contracts", label: "Mes contrats", icon: FileSignature },
  { href: "/account/profile", label: "Mon profil", icon: User },
];

function NavLink({
  item,
  collapsed,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string;
}) {
  const active =
    item.href === "/account"
      ? pathname === "/account"
      : pathname === item.href || pathname.startsWith(item.href + "/");

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-white hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-2.5",
      )}
    >
      <item.icon size={18} className="shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border px-4",
          collapsed && "justify-center",
        )}
      >
        {collapsed ? (
          <span className="text-lg font-bold text-primary">S</span>
        ) : (
          <span className="text-sm font-bold tracking-wide text-sidebar-foreground">
            SaaS{" "}
            <span className="text-primary">●</span>{" "}
            Agentique
          </span>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1">
        <TooltipProvider delayDuration={0}>
          <nav className="space-y-0.5 px-2 py-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                pathname={pathname}
              />
            ))}
          </nav>
        </TooltipProvider>
      </ScrollArea>
    </div>
  );
}

interface CustomerSidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function CustomerSidebar({
  collapsed,
  mobileOpen,
  onMobileClose,
}: CustomerSidebarProps) {
  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "hidden lg:flex h-full flex-shrink-0 flex-col transition-[width] duration-300",
          collapsed ? "w-[68px]" : "w-[260px]",
        )}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {/* Mobile (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent
          side="left"
          className="w-[260px] border-0 bg-sidebar p-0 [&>button]:text-sidebar-foreground"
        >
          <SidebarContent collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  );
}
