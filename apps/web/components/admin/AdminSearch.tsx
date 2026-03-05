"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminSearchProps {
  placeholder?: string;
  paramName?: string;
}

export function AdminSearch({
  placeholder = "Rechercher…",
  paramName = "q",
}: AdminSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      const value = e.target.value.trim();
      if (value) {
        params.set(paramName, value);
      } else {
        params.delete(paramName);
      }
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, paramName],
  );

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="h-8 pl-9 text-sm w-64"
        placeholder={placeholder}
        defaultValue={searchParams.get(paramName) ?? ""}
        onChange={handleChange}
      />
    </div>
  );
}
