"use server";

import { revalidatePath } from "next/cache";
import { createContractSchema, type CreateContractInput } from "@/lib/schemas/contract.schemas";
import { maintenanceContractService } from "@saas/services";
import { withAdmin, ok, fail, handleActionError, type ActionResult } from "@/lib/action-result";
import { requireAdmin } from "@/lib/auth";
import type { MaintenanceContract } from "@saas/db";

export async function createContractAction(
  input: CreateContractInput,
): Promise<ActionResult<MaintenanceContract>> {
  try {
    const user = await requireAdmin();
    const data = createContractSchema.parse(input);
    const existing = await maintenanceContractService.listContractsByClient(data.clientId);
    if (existing.length > 0) {
      return fail("CONTRACT_DUPLICATE", "Ce client a déjà un contrat de maintenance.", 409);
    }
    const contract = await maintenanceContractService.createContract({
      ...data,
      ownerId: user.id,
    });
    revalidatePath("/admin/contracts");
    return ok(contract);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function cancelContractAction(
  contractId: string,
): Promise<ActionResult<MaintenanceContract>> {
  return withAdmin(async () => {
    const contract = await maintenanceContractService.cancelContract(contractId);
    revalidatePath("/admin/contracts");
    return contract;
  });
}
