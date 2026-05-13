import { describe, it, expect, vi, beforeEach } from "vitest";

const makeDrizzleMock = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select", "from", "where", "limit",
    "insert", "values", "returning",
    "update", "set",
    "delete",
    "orderBy", "for",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  chain.transaction = vi.fn(async (fn: (tx: typeof chain) => unknown) => fn(chain));
  return chain;
};

let dbMock = makeDrizzleMock();

vi.mock("@saas/db", () => ({
  get db() { return dbMock; },
  maintenanceContracts: {
    id: "id",
    clientId: "clientId",
    prestationId: "prestationId",
    billingMode: "billingMode",
    status: "status",
    stripeSubscriptionId: "stripeSubscriptionId",
    stripeCustomerId: "stripeCustomerId",
    monthlyPriceEurCents: "monthlyPriceEurCents",
    currentPeriodStart: "currentPeriodStart",
    currentPeriodEnd: "currentPeriodEnd",
    startedAt: "startedAt",
    canceledAt: "canceledAt",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  },
  maintenanceStatusEnum: { enumValues: ["active", "past_due", "canceled"] as const },
  billingModeEnum: { enumValues: ["stripe_auto", "manual_invoice"] as const },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ op: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  inArray: vi.fn((...args: unknown[]) => ({ op: "inArray", args })),
  desc: vi.fn((...args: unknown[]) => ({ op: "desc", args })),
}));

const mockCancelSubscription = vi.fn();
vi.mock("../stripe.service", () => ({
  getStripeService: vi.fn(() => ({
    cancelSubscription: mockCancelSubscription,
  })),
}));

import {
  listContractsByClient,
  listAllContracts,
  getContractById,
  getContractByStripeSubscriptionId,
  createContract,
  cancelContract,
  transitionContractStatus,
  syncFromStripeSubscription,
  attachStripeSubscriptionToContract,
  ClientAlreadyHasActiveContractError,
  InvalidContractTransitionError,
  ContractNotInStripeAutoModeError,
} from "../maintenance-contract.service";
import { getStripeService } from "../stripe.service";

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: "contract-1",
    clientId: "client-1",
    prestationId: "prestation-1",
    billingMode: "stripe_auto",
    status: "active",
    stripeSubscriptionId: null,
    stripeCustomerId: null,
    monthlyPriceEurCents: 5000,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    startedAt: new Date("2026-01-01"),
    canceledAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("maintenance-contract.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock = makeDrizzleMock();
  });

  describe("listContractsByClient", () => {
    it("should return contracts filtered by clientId", async () => {
      const contracts = [makeContract()];
      dbMock.where.mockResolvedValueOnce(contracts);

      const result = await listContractsByClient("client-1");

      expect(result).toEqual(contracts);
    });

    it("should filter by status when provided", async () => {
      const contracts = [makeContract()];
      dbMock.where.mockResolvedValueOnce(contracts);

      const result = await listContractsByClient("client-1", { status: "active" });

      expect(result).toEqual(contracts);
    });
  });

  describe("listAllContracts", () => {
    it("should return all contracts without filters", async () => {
      const contracts = [makeContract()];
      dbMock.from.mockResolvedValueOnce(contracts);

      const result = await listAllContracts();

      expect(result).toEqual(contracts);
    });

    it("should filter by status and billingMode", async () => {
      const contracts = [makeContract()];
      dbMock.where.mockResolvedValueOnce(contracts);

      const result = await listAllContracts({ status: "active", billingMode: "stripe_auto" });

      expect(result).toEqual(contracts);
    });
  });

  describe("getContractById", () => {
    it("should return contract when found", async () => {
      const contract = makeContract();
      dbMock.limit.mockResolvedValueOnce([contract]);

      const result = await getContractById("contract-1");

      expect(result).toEqual(contract);
    });

    it("should return null when not found", async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const result = await getContractById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getContractByStripeSubscriptionId", () => {
    it("should return contract by stripeSubscriptionId", async () => {
      const contract = makeContract({ stripeSubscriptionId: "sub_123" });
      dbMock.limit.mockResolvedValueOnce([contract]);

      const result = await getContractByStripeSubscriptionId("sub_123");

      expect(result).toEqual(contract);
    });
  });

  describe("createContract", () => {
    it("should create a new contract when no active duplicate exists", async () => {
      // Arrange - pre-check returns empty
      dbMock.where.mockResolvedValueOnce([]);
      const newContract = makeContract();
      dbMock.returning.mockResolvedValueOnce([newContract]);

      // Act
      const result = await createContract({
        clientId: "client-1",
        prestationId: "prestation-1",
        billingMode: "stripe_auto",
        monthlyPriceEurCents: 5000,
        startedAt: new Date("2026-01-01"),
      });

      // Assert
      expect(result).toEqual(newContract);
      expect(getStripeService).not.toHaveBeenCalled();
    });

    it("should throw ClientAlreadyHasActiveContractError when duplicate active exists", async () => {
      // Arrange - pre-check returns existing active contract
      dbMock.where.mockResolvedValueOnce([makeContract()]);

      // Act & Assert
      await expect(
        createContract({
          clientId: "client-1",
          prestationId: "prestation-1",
          billingMode: "stripe_auto",
          monthlyPriceEurCents: 5000,
          startedAt: new Date("2026-01-01"),
        }),
      ).rejects.toThrow(ClientAlreadyHasActiveContractError);
    });

    it("should allow creating contract when previous one is canceled", async () => {
      // Arrange - pre-check returns empty (canceled contracts excluded)
      dbMock.where.mockResolvedValueOnce([]);
      const newContract = makeContract({ id: "contract-2" });
      dbMock.returning.mockResolvedValueOnce([newContract]);

      // Act
      const result = await createContract({
        clientId: "client-1",
        prestationId: "prestation-1",
        billingMode: "stripe_auto",
        monthlyPriceEurCents: 5000,
        startedAt: new Date("2026-01-01"),
      });

      // Assert
      expect(result).toEqual(newContract);
    });
  });

  describe("cancelContract", () => {
    it("should cancel a stripe_auto contract and call Stripe", async () => {
      // Arrange
      const contract = makeContract({
        billingMode: "stripe_auto",
        stripeSubscriptionId: "sub_123",
      });
      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.for.mockResolvedValueOnce([contract]);
        const canceledContract = makeContract({ status: "canceled", canceledAt: new Date() });
        txMock.returning.mockResolvedValueOnce([canceledContract]);
        return fn(txMock);
      });

      // Act
      const result = await cancelContract("contract-1");

      // Assert
      expect(result.status).toBe("canceled");
      expect(result.canceledAt).not.toBeNull();
      expect(mockCancelSubscription).toHaveBeenCalledWith("sub_123");
    });

    it("should cancel a manual_invoice contract without calling Stripe", async () => {
      // Arrange
      const contract = makeContract({ billingMode: "manual_invoice" });
      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.for.mockResolvedValueOnce([contract]);
        const canceledContract = makeContract({ status: "canceled", canceledAt: new Date() });
        txMock.returning.mockResolvedValueOnce([canceledContract]);
        return fn(txMock);
      });

      // Act
      const result = await cancelContract("contract-1");

      // Assert
      expect(result.status).toBe("canceled");
      expect(mockCancelSubscription).not.toHaveBeenCalled();
    });

    it("should return unchanged if already canceled (idempotent)", async () => {
      // Arrange
      const canceledContract = makeContract({ status: "canceled", canceledAt: new Date() });
      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.for.mockResolvedValueOnce([canceledContract]);
        return fn(txMock);
      });

      // Act
      const result = await cancelContract("contract-1");

      // Assert
      expect(result.status).toBe("canceled");
      expect(mockCancelSubscription).not.toHaveBeenCalled();
    });

    it("should still update DB even if Stripe cancelSubscription throws", async () => {
      // Arrange
      const contract = makeContract({
        billingMode: "stripe_auto",
        stripeSubscriptionId: "sub_123",
      });
      mockCancelSubscription.mockRejectedValueOnce(new Error("Stripe 404"));
      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.for.mockResolvedValueOnce([contract]);
        const canceledContract = makeContract({ status: "canceled", canceledAt: new Date() });
        txMock.returning.mockResolvedValueOnce([canceledContract]);
        return fn(txMock);
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Act
      const result = await cancelContract("contract-1");

      // Assert
      expect(result.status).toBe("canceled");
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("transitionContractStatus", () => {
    it("should transition from active to past_due", async () => {
      // Arrange
      const contract = makeContract({ status: "active" });
      dbMock.limit.mockResolvedValueOnce([contract]);
      const updatedContract = makeContract({ status: "past_due" });
      dbMock.returning.mockResolvedValueOnce([updatedContract]);

      // Act
      const result = await transitionContractStatus("contract-1", "past_due");

      // Assert
      expect(result.status).toBe("past_due");
    });

    it("should return unchanged when transitioning to same status (idempotent)", async () => {
      // Arrange
      const contract = makeContract({ status: "active" });
      dbMock.limit.mockResolvedValueOnce([contract]);

      // Act
      const result = await transitionContractStatus("contract-1", "active");

      // Assert
      expect(result.status).toBe("active");
    });

    it("should throw InvalidContractTransitionError for invalid transition", async () => {
      // Arrange
      const contract = makeContract({ status: "canceled" });
      dbMock.limit.mockResolvedValueOnce([contract]);

      // Act & Assert
      await expect(
        transitionContractStatus("contract-1", "active"),
      ).rejects.toThrow(InvalidContractTransitionError);
    });

    it("should throw when contract not found", async () => {
      // Arrange
      dbMock.limit.mockResolvedValueOnce([]);

      // Act & Assert
      await expect(
        transitionContractStatus("nonexistent", "active"),
      ).rejects.toThrow("Contract not found");
    });
  });

  describe("syncFromStripeSubscription", () => {
    it("should sync periods and transition status when valid", async () => {
      // Arrange
      const contract = makeContract({
        status: "active",
        stripeSubscriptionId: "sub_123",
      });
      const periodStart = new Date("2026-02-01");
      const periodEnd = new Date("2026-03-01");

      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.limit.mockResolvedValueOnce([contract]);
        const updatedContract = makeContract({
          status: "past_due",
          stripeSubscriptionId: "sub_123",
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        });
        txMock.returning.mockResolvedValueOnce([updatedContract]);
        txMock.limit.mockResolvedValueOnce([{ ...updatedContract, status: "active" }]);
        txMock.returning.mockResolvedValueOnce([updatedContract]);
        return fn(txMock);
      });

      // Act
      const result = await syncFromStripeSubscription({
        stripeSubscriptionId: "sub_123",
        stripeStatus: "past_due",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });

      // Assert
      expect(result).not.toBeNull();
      expect(result!.currentPeriodStart).toEqual(periodStart);
    });

    it("should return null when contract not found", async () => {
      // Arrange
      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.limit.mockResolvedValueOnce([]);
        return fn(txMock);
      });

      // Act
      const result = await syncFromStripeSubscription({
        stripeSubscriptionId: "sub_nonexistent",
        stripeStatus: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      // Assert
      expect(result).toBeNull();
    });

    it("should warn and skip transition when invalid (canceled to active)", async () => {
      // Arrange
      const contract = makeContract({
        status: "canceled",
        stripeSubscriptionId: "sub_123",
      });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      dbMock.transaction.mockImplementationOnce(async (fn: Function) => {
        const txMock = makeDrizzleMock();
        txMock.limit.mockResolvedValueOnce([contract]);
        const updatedContract = makeContract({
          ...contract,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        });
        txMock.returning.mockResolvedValueOnce([updatedContract]);
        return fn(txMock);
      });

      // Act
      const result = await syncFromStripeSubscription({
        stripeSubscriptionId: "sub_123",
        stripeStatus: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
      });

      // Assert
      expect(result).not.toBeNull();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("attachStripeSubscriptionToContract", () => {
    it("should throw ContractNotInStripeAutoModeError for manual_invoice", async () => {
      // Arrange
      const contract = makeContract({ billingMode: "manual_invoice" });
      dbMock.limit.mockResolvedValueOnce([contract]);

      // Act & Assert
      await expect(
        attachStripeSubscriptionToContract("contract-1", {
          stripeSubscriptionId: "sub_123",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        }),
      ).rejects.toThrow(ContractNotInStripeAutoModeError);
    });

    it("should throw when contract already has a stripe subscription", async () => {
      // Arrange
      const contract = makeContract({ stripeSubscriptionId: "sub_existing" });
      dbMock.limit.mockResolvedValueOnce([contract]);

      // Act & Assert
      await expect(
        attachStripeSubscriptionToContract("contract-1", {
          stripeSubscriptionId: "sub_123",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        }),
      ).rejects.toThrow("Contract already has a Stripe subscription attached");
    });

    it("should attach stripe subscription to contract", async () => {
      // Arrange
      const contract = makeContract({ billingMode: "stripe_auto", stripeSubscriptionId: null });
      dbMock.limit.mockResolvedValueOnce([contract]);
      const updatedContract = makeContract({ stripeSubscriptionId: "sub_123" });
      dbMock.returning.mockResolvedValueOnce([updatedContract]);

      // Act
      const result = await attachStripeSubscriptionToContract("contract-1", {
        stripeSubscriptionId: "sub_123",
        currentPeriodStart: new Date("2026-01-01"),
        currentPeriodEnd: new Date("2026-02-01"),
      });

      // Assert
      expect(result.stripeSubscriptionId).toBe("sub_123");
    });
  });
});
