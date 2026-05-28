// @vitest-environment jsdom
import React from "react";
(globalThis as any).React = React;
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ usePathname: () => "/account" }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/utils", () => ({ cn: (...args: any[]) => args.filter(Boolean).join(" ") }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: any) => <div>{children}</div>,
  SheetContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
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
