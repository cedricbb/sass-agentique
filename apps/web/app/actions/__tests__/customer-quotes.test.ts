import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@saas/services", () => {
  const InvalidQuoteTransitionError = class extends Error {
    constructor(from: string, to: string) {
      super(`Invalid transition from "${from}" to "${to}"`);
      this.name = "InvalidQuoteTransitionError";
    }
  };
  Object.defineProperty(InvalidQuoteTransitionError, "name", {
    value: "InvalidQuoteTransitionError",
  });
  return {
    getQuoteById: vi.fn(),
    transitionQuoteStatus: vi.fn(),
    InvalidQuoteTransitionError,
  };
});

vi.mock("@/lib/auth", () => ({
  requireCustomer: vi.fn(),
  assertClientOwnershipOrThrow: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  acceptCustomerQuoteAction,
  declineCustomerQuoteAction,
} from "../customer-quotes";
import { getQuoteById, transitionQuoteStatus, InvalidQuoteTransitionError } from "@saas/services";
import { requireCustomer, assertClientOwnershipOrThrow } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireCustomer = vi.mocked(requireCustomer);
const mockedAssertClientOwnershipOrThrow = vi.mocked(assertClientOwnershipOrThrow);
const mockedGetQuoteById = vi.mocked(getQuoteById);
const mockedTransitionQuoteStatus = vi.mocked(transitionQuoteStatus);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const CLIENT_ID = "client-aaa";
const QUOTE_ID = "quote-001";

const fakeScope = {
  user: { id: "user-1", role: "client", email: "customer@test.com", name: "Customer" },
  client: { id: CLIENT_ID },
} as unknown as Awaited<ReturnType<typeof requireCustomer>>;

const mockSentQuote = {
  id: QUOTE_ID,
  clientId: CLIENT_ID,
  number: "Q-2026-001",
  status: "sent",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAcceptedQuote = { ...mockSentQuote, status: "accepted" };
const mockDeclinedQuote = { ...mockSentQuote, status: "declined" };

function makeRedirectError() {
  const err = new Error("NEXT_REDIRECT");
  (err as unknown as { digest: string }).digest = "NEXT_REDIRECT;/login";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireCustomer.mockResolvedValue(fakeScope);
  mockedAssertClientOwnershipOrThrow.mockReturnValue(mockSentQuote as never);
  mockedGetQuoteById.mockResolvedValue(mockSentQuote as never);
});

describe("acceptCustomerQuoteAction", () => {
  it("rejects_cross_client_accept_with_forbidden_scope", async () => {
    const ForbiddenScopeError = class extends Error {
      constructor() {
        super("Ressource introuvable.");
        this.name = "ForbiddenScopeError";
      }
    };
    Object.defineProperty(ForbiddenScopeError, "name", { value: "ForbiddenScopeError" });
    mockedAssertClientOwnershipOrThrow.mockImplementation(() => {
      throw new ForbiddenScopeError();
    });

    const result = await acceptCustomerQuoteAction(QUOTE_ID);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN_SCOPE" },
    });
  });

  it("rejects_invalid_transition_with_error_code", async () => {
    mockedTransitionQuoteStatus.mockRejectedValue(
      new InvalidQuoteTransitionError("accepted", "accepted"),
    );
    mockedGetQuoteById.mockResolvedValue(mockAcceptedQuote as never);
    mockedAssertClientOwnershipOrThrow.mockReturnValue(mockAcceptedQuote as never);

    const result = await acceptCustomerQuoteAction(QUOTE_ID);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "QUOTE_INVALID_TRANSITION" },
    });
  });

  it("happy path accept — transitions to accepted and revalidates", async () => {
    mockedTransitionQuoteStatus.mockResolvedValue(mockAcceptedQuote as never);

    const result = await acceptCustomerQuoteAction(QUOTE_ID);

    expect(result).toEqual({ ok: true, data: mockAcceptedQuote });
    expect(mockedTransitionQuoteStatus).toHaveBeenCalledWith(QUOTE_ID, "accepted");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/account/quotes");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/account/quotes/${QUOTE_ID}`);
  });

  it("non-customer redirect bubbles up", async () => {
    mockedRequireCustomer.mockRejectedValue(makeRedirectError());
    await expect(acceptCustomerQuoteAction(QUOTE_ID)).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("declineCustomerQuoteAction", () => {
  it("rejects_cross_client_accept_with_forbidden_scope — decline variant", async () => {
    const ForbiddenScopeError = class extends Error {
      constructor() {
        super("Ressource introuvable.");
        this.name = "ForbiddenScopeError";
      }
    };
    Object.defineProperty(ForbiddenScopeError, "name", { value: "ForbiddenScopeError" });
    mockedAssertClientOwnershipOrThrow.mockImplementation(() => {
      throw new ForbiddenScopeError();
    });

    const result = await declineCustomerQuoteAction(QUOTE_ID);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN_SCOPE" },
    });
  });

  it("rejects_invalid_transition_with_error_code — decline variant", async () => {
    mockedTransitionQuoteStatus.mockRejectedValue(
      new InvalidQuoteTransitionError("declined", "declined"),
    );
    mockedGetQuoteById.mockResolvedValue(mockDeclinedQuote as never);
    mockedAssertClientOwnershipOrThrow.mockReturnValue(mockDeclinedQuote as never);

    const result = await declineCustomerQuoteAction(QUOTE_ID);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "QUOTE_INVALID_TRANSITION" },
    });
  });

  it("happy path decline — transitions to declined and revalidates", async () => {
    mockedTransitionQuoteStatus.mockResolvedValue(mockDeclinedQuote as never);

    const result = await declineCustomerQuoteAction(QUOTE_ID);

    expect(result).toEqual({ ok: true, data: mockDeclinedQuote });
    expect(mockedTransitionQuoteStatus).toHaveBeenCalledWith(QUOTE_ID, "declined");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/account/quotes");
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/account/quotes/${QUOTE_ID}`);
  });
});
