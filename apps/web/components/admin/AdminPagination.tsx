"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
}

export function AdminPagination({ currentPage, totalPages }: AdminPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} sur {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={currentPage <= 1}
          onClick={() => goTo(currentPage - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={currentPage >= totalPages}
          onClick={() => goTo(currentPage + 1)}
        >
          Suivant
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
