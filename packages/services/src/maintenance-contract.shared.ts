export const CUSTOMER_VISIBLE_CONTRACT_STATUSES = ["active", "past_due"] as const;

export type CustomerVisibleContractStatus = (typeof CUSTOMER_VISIBLE_CONTRACT_STATUSES)[number];

export function computeContractBilledAmount(
  contract: { monthlyPriceEurCents: number; startedAt: Date; canceledAt: Date | null },
  now: Date,
): { monthsBilled: number; billedAmountEurCents: number } {
  const endDate =
    contract.canceledAt !== null && contract.canceledAt < now ? contract.canceledAt : now;
  const monthsBilled = Math.max(
    0,
    (endDate.getFullYear() - contract.startedAt.getFullYear()) * 12 +
      (endDate.getMonth() - contract.startedAt.getMonth()),
  );
  return {
    monthsBilled,
    billedAmountEurCents: contract.monthlyPriceEurCents * monthsBilled,
  };
}
