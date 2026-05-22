import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => ({
  maintenanceContractService: {
    listContractsByClient: vi.fn(),
    createContract: vi.fn(),
    cancelContract: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createContractAction,
  cancelContractAction,
} from "../contracts";
import { maintenanceContractService } from "@saas/services";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedListByClient = vi.mocked(maintenanceContractService.listContractsByClient);
const mockedCreate = vi.mocked(maintenanceContractService.createContract);
const mockedCancel = vi.mocked(maintenanceContractService.cancelContract);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const VALID_UUID = "00000000-0000-0000-0000-000000000001";
const VALID_UUID_2 = "00000000-0000-0000-0000-000000000002";

const fakeAdmin = { id: "u1", role: "admin" } as unknown as Awaited<
  ReturnType<typeof requireAdmin>
>;

const fakeContract = {
  id: "c1",
  ownerId: "u1",
  clientId: VALID_UUID,
  prestationId: VALID_UUID_2,
  billingMode: "manual_invoice" as const,
  status: "active" as const,
  stripeSubscriptionId: null,
  stripeCustomerId: null,
  monthlyPriceEurCents: 5000,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  startedAt: new Date("2026-01-15"),
  canceledAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("createContractAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("AC1 — rejects invalid input (monthlyPriceEurCents <= 0)", async () => {
    const result = await createContractAction({
      clientId: VALID_UUID,
      prestationId: VALID_UUID_2,
      billingMode: "manual_invoice",
      monthlyPriceEurCents: -1,
      startedAt: new Date("2026-01-15"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("AC1 — rejects invalid clientId (not UUID)", async () => {
    const result = await createContractAction({
      clientId: "not-a-uuid",
      prestationId: VALID_UUID_2,
      billingMode: "manual_invoice",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-01-15"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("AC2 — PRE-CHECK: existing contract returns CONTRACT_DUPLICATE 409", async () => {
    mockedListByClient.mockResolvedValue([fakeContract] as never);

    const result = await createContractAction({
      clientId: VALID_UUID,
      prestationId: VALID_UUID_2,
      billingMode: "manual_invoice",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-01-15"),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONTRACT_DUPLICATE");
      expect(result.error.status).toBe(409);
    }
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("AC2 — happy path: no existing contract creates successfully", async () => {
    mockedListByClient.mockResolvedValue([] as never);
    mockedCreate.mockResolvedValue(fakeContract as never);

    const result = await createContractAction({
      clientId: VALID_UUID,
      prestationId: VALID_UUID_2,
      billingMode: "manual_invoice",
      monthlyPriceEurCents: 5000,
      startedAt: new Date("2026-01-15"),
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe("c1");
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: "u1", clientId: VALID_UUID }),
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/contracts");
  });
});

describe("cancelContractAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  });

  it("AC3 — cancel success", async () => {
    const canceledContract = { ...fakeContract, status: "canceled" as const, canceledAt: new Date() };
    mockedCancel.mockResolvedValue(canceledContract as never);

    const result = await cancelContractAction("c1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("canceled");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/contracts");
  });

  it("AC3 — idempotent: re-cancel returns ok", async () => {
    const alreadyCanceled = { ...fakeContract, status: "canceled" as const, canceledAt: new Date() };
    mockedCancel.mockResolvedValue(alreadyCanceled as never);

    const result = await cancelContractAction("c1");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("canceled");
  });
});
