// @vitest-environment jsdom
import React from "react";
(globalThis as any).React = React;
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

let pathnameValue = "/account";
vi.mock("next/navigation", () => ({ usePathname: () => pathnameValue }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));
vi.mock("../CustomerSidebar", () => ({
  CustomerSidebar: () => <nav data-testid="sidebar" />,
}));
vi.mock("@/components/auth/EmailVerificationBanner", () => ({
  EmailVerificationBanner: () => null,
}));
vi.mock("@/components/auth/LogoutButton", () => ({
  LogoutButton: () => <button>Logout</button>,
}));
vi.mock("@/lib/utils", () => ({ cn: (...args: any[]) => args.filter(Boolean).join(" ") }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
}));
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <span>{children}</span>,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
}));

import { CustomerShell } from "../CustomerShell";

const USER = { id: "1", name: "Test User", email: "test@test.com", emailVerified: true };

describe("CustomerShell", () => {
  beforeEach(() => { cleanup(); });

  it("does not include orders in PAGE_TITLES", () => {
    pathnameValue = "/account/orders";
    render(<CustomerShell user={USER}>content</CustomerShell>);
    expect(screen.queryByText("Mes commandes")).toBeNull();
  });

  it("resolves quotes page title", () => {
    pathnameValue = "/account/quotes";
    render(<CustomerShell user={USER}>content</CustomerShell>);
    expect(screen.getByText("Mes devis")).toBeDefined();
  });

  it("resolves invoices page title", () => {
    pathnameValue = "/account/invoices";
    render(<CustomerShell user={USER}>content</CustomerShell>);
    expect(screen.getByText("Mes factures")).toBeDefined();
  });

  it("resolves reports page title", () => {
    pathnameValue = "/account/reports";
    render(<CustomerShell user={USER}>content</CustomerShell>);
    expect(screen.getByText("Mes rapports")).toBeDefined();
  });

  it("resolves account page title as Accueil", () => {
    pathnameValue = "/account";
    render(<CustomerShell user={USER}>content</CustomerShell>);
    expect(screen.getByText("Accueil")).toBeDefined();
  });

  it("displays clientName when provided", () => {
    pathnameValue = "/account";
    render(<CustomerShell user={USER} clientName="Acme Studio">content</CustomerShell>);
    expect(screen.getByText(/Espace client — Acme Studio/)).toBeDefined();
  });

  it("does not display clientName span when null", () => {
    pathnameValue = "/account";
    render(<CustomerShell user={USER} clientName={null}>content</CustomerShell>);
    expect(screen.queryByText(/Espace client/)).toBeNull();
  });
});
