"use client";

import { createContext, useContext, type ReactNode } from "react";

export type TenantContextValue = {
  tenant: {
    id: string;
    slug: string;
    plan: string;
  };
  currentUser: {
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  };
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: TenantContextValue;
}) {
  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return ctx;
}
