import { requireCustomer } from "@/lib/auth";
import { CustomerShell } from "@/components/layout/CustomerShell";
import type { ReactNode } from "react";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { user, client } = await requireCustomer();

  return (
    <CustomerShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      }}
      clientName={client.name}
    >
      {children}
    </CustomerShell>
  );
}
