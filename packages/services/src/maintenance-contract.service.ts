import {
  db,
  type MaintenanceContract,
  type NewMaintenanceContract,
  maintenanceContracts,
  maintenanceStatusEnum,
  billingModeEnum,
} from "@saas/db";
import { eq, and, inArray } from "drizzle-orm";
import { getStripeService } from "./stripe.service";

type Db = typeof db;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbOrTx = Db | Tx;

export type MaintenanceStatus = (typeof maintenanceStatusEnum.enumValues)[number];
export type MaintenanceBillingMode = (typeof billingModeEnum.enumValues)[number];

export type StripeSubscriptionSyncPayload = {
  stripeSubscriptionId: string;
  stripeStatus: "active" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "trialing" | "unpaid" | "paused";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
};

export class ClientAlreadyHasActiveContractError extends Error {
  constructor(clientId: string, prestationId: string) {
    super(`Client ${clientId} already has an active contract for prestation ${prestationId}`);
    this.name = "ClientAlreadyHasActiveContractError";
  }
}

export class InvalidContractTransitionError extends Error {
  constructor(from: MaintenanceStatus, to: MaintenanceStatus) {
    super(`Invalid contract transition from ${from} to ${to}`);
    this.name = "InvalidContractTransitionError";
  }
}

export class ContractNotInStripeAutoModeError extends Error {
  constructor(contractId: string, mode: MaintenanceBillingMode) {
    super(`Contract ${contractId} is in ${mode} mode, expected stripe_auto`);
    this.name = "ContractNotInStripeAutoModeError";
  }
}

const VALID_TRANSITIONS: Record<string, MaintenanceStatus[]> = {
  active: ["past_due", "canceled"],
  past_due: ["active", "canceled"],
};

function isValidTransition(from: MaintenanceStatus, to: MaintenanceStatus): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

const STRIPE_STATUS_MAP: Record<string, MaintenanceStatus> = {
  active: "active",
  trialing: "active",
  past_due: "past_due",
  unpaid: "past_due",
  canceled: "canceled",
  incomplete_expired: "canceled",
  incomplete: "past_due",
  paused: "past_due",
};

export async function listContractsByClient(
  clientId: string,
  opts?: { status?: MaintenanceStatus | MaintenanceStatus[] },
): Promise<MaintenanceContract[]> {
  const conditions = [eq(maintenanceContracts.clientId, clientId)];

  if (opts?.status) {
    if (Array.isArray(opts.status)) {
      conditions.push(inArray(maintenanceContracts.status, opts.status));
    } else {
      conditions.push(eq(maintenanceContracts.status, opts.status));
    }
  }

  return db.select().from(maintenanceContracts).where(and(...conditions));
}

export async function listAllContracts(
  opts?: { status?: MaintenanceStatus | MaintenanceStatus[]; billingMode?: MaintenanceBillingMode },
): Promise<MaintenanceContract[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (opts?.status) {
    if (Array.isArray(opts.status)) {
      conditions.push(inArray(maintenanceContracts.status, opts.status));
    } else {
      conditions.push(eq(maintenanceContracts.status, opts.status));
    }
  }
  if (opts?.billingMode) {
    conditions.push(eq(maintenanceContracts.billingMode, opts.billingMode));
  }

  if (conditions.length === 0) {
    return db.select().from(maintenanceContracts);
  }
  return db.select().from(maintenanceContracts).where(and(...conditions));
}

export async function getContractById(id: string): Promise<MaintenanceContract | null> {
  const results = await db
    .select()
    .from(maintenanceContracts)
    .where(eq(maintenanceContracts.id, id))
    .limit(1);
  return results[0] ?? null;
}

export async function getContractByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<MaintenanceContract | null> {
  const results = await db
    .select()
    .from(maintenanceContracts)
    .where(eq(maintenanceContracts.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return results[0] ?? null;
}

async function assertNoActiveContract(clientId: string, prestationId: string): Promise<void> {
  const existing = await db
    .select()
    .from(maintenanceContracts)
    .where(
      and(
        eq(maintenanceContracts.clientId, clientId),
        eq(maintenanceContracts.prestationId, prestationId),
        inArray(maintenanceContracts.status, ["active", "past_due"]),
      ),
    );

  if (existing.length > 0) {
    throw new ClientAlreadyHasActiveContractError(clientId, prestationId);
  }
}

function buildNewContractValues(input: NewMaintenanceContract) {
  return {
    ...input,
    status: "active" as const,
    stripeSubscriptionId: null,
    canceledAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
  };
}

export async function createContract(
  input: NewMaintenanceContract,
): Promise<MaintenanceContract> {
  await assertNoActiveContract(input.clientId, input.prestationId);

  const [created] = await db
    .insert(maintenanceContracts)
    .values(buildNewContractValues(input))
    .returning();

  return created;
}

async function tryCancelStripeSubscription(contract: MaintenanceContract): Promise<void> {
  if (contract.billingMode === "stripe_auto" && contract.stripeSubscriptionId) {
    try {
      await getStripeService().cancelSubscription(contract.stripeSubscriptionId);
    } catch (stripeError) {
      console.warn("[MaintenanceContract.cancelContract] Stripe cancellation failed, proceeding with DB update", {
        contractId: contract.id,
        error: stripeError,
      });
    }
  }
}

async function markContractCanceled(tx: Tx, id: string): Promise<MaintenanceContract> {
  const [updated] = await tx
    .update(maintenanceContracts)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(maintenanceContracts.id, id))
    .returning();

  return updated;
}

export async function cancelContract(id: string): Promise<MaintenanceContract> {
  return db.transaction(async (tx) => {
    const [contract] = await tx
      .select()
      .from(maintenanceContracts)
      .where(eq(maintenanceContracts.id, id))
      .for("update");

    if (!contract) {
      throw new Error("Contract not found");
    }

    if (contract.status === "canceled") {
      return contract;
    }

    await tryCancelStripeSubscription(contract);

    return markContractCanceled(tx, id);
  });
}

async function fetchContractOrThrow(dbOrTx: DbOrTx, id: string): Promise<MaintenanceContract> {
  const results = await dbOrTx
    .select()
    .from(maintenanceContracts)
    .where(eq(maintenanceContracts.id, id))
    .limit(1);

  const contract = results[0];
  if (!contract) {
    throw new Error("Contract not found");
  }

  return contract;
}

function buildTransitionSetClause(to: MaintenanceStatus): Record<string, unknown> {
  const setClause: Record<string, unknown> = {
    status: to,
    updatedAt: new Date(),
  };

  if (to === "canceled") {
    setClause.canceledAt = new Date();
  }

  return setClause;
}

export async function transitionContractStatus(
  id: string,
  to: MaintenanceStatus,
  opts?: { tx?: DbOrTx },
): Promise<MaintenanceContract> {
  const dbOrTx = opts?.tx ?? db;
  const contract = await fetchContractOrThrow(dbOrTx, id);

  if (contract.status === to) {
    return contract;
  }

  if (!isValidTransition(contract.status, to)) {
    throw new InvalidContractTransitionError(contract.status, to);
  }

  const [updated] = await dbOrTx
    .update(maintenanceContracts)
    .set(buildTransitionSetClause(to))
    .where(eq(maintenanceContracts.id, id))
    .returning();

  return updated;
}

async function findContractBySubscriptionId(
  tx: DbOrTx,
  stripeSubscriptionId: string,
): Promise<MaintenanceContract | undefined> {
  const results = await tx
    .select()
    .from(maintenanceContracts)
    .where(eq(maintenanceContracts.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return results[0];
}

async function updatePeriodDates(
  tx: DbOrTx,
  contractId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<MaintenanceContract> {
  const [updated] = await tx
    .update(maintenanceContracts)
    .set({
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(maintenanceContracts.id, contractId))
    .returning();
  return updated;
}

async function reconcileStripeStatus(
  tx: DbOrTx,
  contract: MaintenanceContract,
  updatedContract: MaintenanceContract,
  stripeStatus: string,
): Promise<MaintenanceContract> {
  const mappedStatus = STRIPE_STATUS_MAP[stripeStatus];
  if (!mappedStatus || mappedStatus === contract.status) {
    return updatedContract;
  }
  if (isValidTransition(contract.status, mappedStatus)) {
    return transitionContractStatus(contract.id, mappedStatus, { tx });
  }
  console.warn("[MaintenanceContract.syncFromStripeSubscription] Invalid transition, skipping status update", {
    contractId: contract.id,
    from: contract.status,
    to: mappedStatus,
  });
  return updatedContract;
}

function assertContractAcceptsSubscription(contract: MaintenanceContract, contractId: string): void {
  if (contract.billingMode !== "stripe_auto") {
    throw new ContractNotInStripeAutoModeError(contractId, contract.billingMode);
  }
  if (contract.stripeSubscriptionId !== null) {
    throw new Error("Contract already has a Stripe subscription attached");
  }
}

export async function syncFromStripeSubscription(
  payload: StripeSubscriptionSyncPayload,
  opts?: { tx?: DbOrTx },
): Promise<MaintenanceContract | null> {
  const executeSync = async (tx: DbOrTx): Promise<MaintenanceContract | null> => {
    const contract = await findContractBySubscriptionId(tx, payload.stripeSubscriptionId);
    if (!contract) return null;
    const updated = await updatePeriodDates(tx, contract.id, payload.currentPeriodStart, payload.currentPeriodEnd);
    return reconcileStripeStatus(tx, contract, updated, payload.stripeStatus);
  };

  if (opts?.tx) return executeSync(opts.tx);
  return db.transaction(async (tx) => executeSync(tx));
}

export async function attachStripeSubscriptionToContract(
  contractId: string,
  payload: {
    stripeSubscriptionId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  },
  opts?: { tx?: DbOrTx },
): Promise<MaintenanceContract> {
  const dbOrTx = opts?.tx ?? db;
  const contract = await fetchContractOrThrow(dbOrTx, contractId);
  assertContractAcceptsSubscription(contract, contractId);
  const [updated] = await dbOrTx
    .update(maintenanceContracts)
    .set({
      stripeSubscriptionId: payload.stripeSubscriptionId,
      currentPeriodStart: payload.currentPeriodStart,
      currentPeriodEnd: payload.currentPeriodEnd,
      updatedAt: new Date(),
    })
    .where(eq(maintenanceContracts.id, contractId))
    .returning();
  return updated;
}
