"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelContractAction } from "@/app/actions/contracts";
import { toastResult } from "@/lib/toast";
import { Button } from "@/components/ui/button";

type CancelContractButtonProps = {
  contractId: string;
  disabled: boolean;
};

export function CancelContractButton({ contractId, disabled }: CancelContractButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelContractAction(contractId);
      if (toastResult(result, "Contrat annulé")) {
        router.refresh();
      }
    });
  }

  return (
    <Button
      variant="destructive"
      data-testid="contract-cancel-button"
      disabled={disabled || isPending}
      onClick={handleCancel}
    >
      Annuler le contrat
    </Button>
  );
}
