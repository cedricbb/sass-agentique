// @vitest-environment jsdom
import React from "react";
(globalThis as Record<string, unknown>).React = React;
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/account" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children?: React.ReactNode; href?: string; [key: string]: unknown }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/utils", () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(" ") }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import { CustomerSidebar } from "../CustomerSidebar";

describe("CustomerSidebar", () => {
  it("renders 5 nav items: Accueil, Devis, Factures, Rapports, Profil", () => {
    render(<CustomerSidebar collapsed={false} mobileOpen={false} onMobileClose={() => {}} />);
    expect(screen.getAllByText("Accueil").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mes devis").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mes factures").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mes rapports").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mon profil").length).toBeGreaterThanOrEqual(1);
  });

  it("does not render orders/commandes item", () => {
    render(<CustomerSidebar collapsed={false} mobileOpen={false} onMobileClose={() => {}} />);
    expect(screen.queryAllByText("Mes commandes")).toHaveLength(0);
  });

  it("has correct hrefs for nav items", () => {
    render(<CustomerSidebar collapsed={false} mobileOpen={false} onMobileClose={() => {}} />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/account");
    expect(hrefs).toContain("/account/quotes");
    expect(hrefs).toContain("/account/invoices");
    expect(hrefs).toContain("/account/reports");
    expect(hrefs).toContain("/account/profile");
    expect(hrefs).not.toContain("/account/orders");
  });
});
