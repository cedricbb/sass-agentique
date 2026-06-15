"use client"
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

export { toast };

export function toastResult<T>(
  result: ActionResult<T>,
  successMessage: string,
): result is { ok: true; data: T } {
  if (!result.ok) {
    toast.error(result.error.message);
    return false;
  }
  toast.success(successMessage);
  return true;
}
