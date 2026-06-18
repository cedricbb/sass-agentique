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
    createQuote: vi.fn(),
    updateQuote: vi.fn(),
    transitionQuoteStatus: vi.fn(),
    getQuoteById: vi.fn(),
    listQuotes: vi.fn(),
    getBusinessProfile: vi.fn(),
    InvalidQuoteTransitionError,
  };
});

vi.mock("@/lib/pdf/generate-quote-pdf", () => ({
  generateAndStoreQuotePdf: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createQuoteAction,
  updateQuoteAction,
  transitionQuoteStatusAction,
  getQuoteByIdAction,
  listQuotesAction,
} from "../quotes";
import {
  createQuote,
  updateQuote,
  transitionQuoteStatus,
  getQuoteById,
  listQuotes,
  getBusinessProfile,
  InvalidQuoteTransitionError,
} from "@saas/services";
import { generateAndStoreQuotePdf } from "@/lib/pdf/generate-quote-pdf";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const mockedRequireAdmin = vi.mocked(requireAdmin);
const mockedCreateQuote = vi.mocked(createQuote);
const mockedUpdateQuote = vi.mocked(updateQuote);
const mockedTransitionQuoteStatus = vi.mocked(transitionQuoteStatus);
const mockedGetQuoteById = vi.mocked(getQuoteById);
const mockedListQuotes = vi.mocked(listQuotes);
const mockedGetBusinessProfile = vi.mocked(getBusinessProfile);
const mockedGenerateAndStoreQuotePdf = vi.mocked(generateAndStoreQuotePdf);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_UUID = "660e8400-e29b-41d4-a716-446655440000";

const fakeAdmin = {
  id: "admin-1",
  email: "admin@test.com",
  role: "admin",
  name: "Admin",
} as unknown as Awaited<ReturnType<typeof requireAdmin>>;

const fakeProfile = { id: "profile-1", ownerId: "owner-1" };

const mockQuote = {
  id: "quote-1",
  clientId: VALID_UUID,
  ownerId: "owner-1",
  projectId: null,
  number: "Q-2026-001",
  status: "draft",
  expiresAt: null,
  vatRateBps: 2000,
  totalEurCents: 0,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeRedirectError() {
  const err = new Error("NEXT_REDIRECT");
  (err as unknown as { digest: string }).digest = "NEXT_REDIRECT;/login";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRequireAdmin.mockResolvedValue(fakeAdmin);
  mockedGetQuoteById.mockResolvedValue(mockQuote as never);
  mockedGetBusinessProfile.mockResolvedValue(fakeProfile as never);
  mockedGenerateAndStoreQuotePdf.mockResolvedValue({ pdfKey: "k" } as never);
});

// --- createQuoteAction (T1-T3) ---

describe("createQuoteAction", () => {
  const validInput = { clientId: VALID_UUID };

  it("T1 — happy path", async () => {
    mockedCreateQuote.mockResolvedValue(mockQuote as never);
    const result = await createQuoteAction(validInput);
    expect(result).toEqual({ ok: true, data: mockQuote });
    expect(mockedCreateQuote).toHaveBeenCalledWith({ clientId: VALID_UUID, ownerId: "admin-1" });
  });

  it("T2 — zod fail clientId not UUID", async () => {
    const result = await createQuoteAction({ clientId: "not-a-uuid" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T3 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(createQuoteAction(validInput)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });

  it("T3b — revalidatePath called", async () => {
    mockedCreateQuote.mockResolvedValue(mockQuote as never);
    await createQuoteAction(validInput);
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/quotes");
  });

  it("T3c — optional fields passed through", async () => {
    const input = {
      clientId: VALID_UUID,
      projectId: OTHER_UUID,
      expiresAt: "2026-12-31" as unknown as Date,
      vatRateBps: 2000,
      notes: "Test notes",
    };
    mockedCreateQuote.mockResolvedValue(mockQuote as never);
    await createQuoteAction(input);
    expect(mockedCreateQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: VALID_UUID,
        projectId: OTHER_UUID,
        vatRateBps: 2000,
        notes: "Test notes",
      }),
    );
  });

  it("T3d — no number field sent to service", async () => {
    mockedCreateQuote.mockResolvedValue(mockQuote as never);
    await createQuoteAction({ clientId: VALID_UUID, number: "Q-HACK" } as never);
    const call = mockedCreateQuote.mock.calls[0][0];
    expect(call).not.toHaveProperty("number");
  });
});

// --- updateQuoteAction (T4-T7) ---

describe("updateQuoteAction", () => {
  it("T4 — happy path", async () => {
    mockedUpdateQuote.mockResolvedValue(mockQuote as never);
    const result = await updateQuoteAction("quote-1", { notes: "updated" });
    expect(result).toEqual({ ok: true, data: mockQuote });
    expect(mockedUpdateQuote).toHaveBeenCalledWith("quote-1", {
      notes: "updated",
    });
  });

  it("T5 — zod fail vatRateBps > 10000", async () => {
    const result = await updateQuoteAction("quote-1", {
      vatRateBps: 10001,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T6 — null → INTERNAL_ERROR", async () => {
    mockedUpdateQuote.mockResolvedValue(null as never);
    const result = await updateQuoteAction("quote-1", { notes: "x" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("T7 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(
      updateQuoteAction("quote-1", { notes: "x" }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T7b — revalidatePath ×2", async () => {
    mockedUpdateQuote.mockResolvedValue(mockQuote as never);
    await updateQuoteAction("quote-1", { notes: "x" });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/quotes");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/quotes/quote-1");
  });

  it("T7c — projectId null dissociation", async () => {
    mockedUpdateQuote.mockResolvedValue(mockQuote as never);
    await updateQuoteAction("quote-1", { projectId: null });
    expect(mockedUpdateQuote).toHaveBeenCalledWith("quote-1", {
      projectId: null,
    });
  });

  it("T7d — empty patch", async () => {
    mockedUpdateQuote.mockResolvedValue(mockQuote as never);
    const result = await updateQuoteAction("quote-1", {});
    expect(result).toEqual({ ok: true, data: mockQuote });
    expect(mockedUpdateQuote).toHaveBeenCalledWith("quote-1", {});
  });
});

// --- transitionQuoteStatusAction (T8-T12) ---

describe("transitionQuoteStatusAction", () => {
  it("T8 — happy path draft→sent", async () => {
    const sent = { ...mockQuote, status: "sent" };
    mockedTransitionQuoteStatus.mockResolvedValue(sent as never);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({ ok: true, data: sent });
    expect(mockedTransitionQuoteStatus).toHaveBeenCalledWith("quote-1", "sent");
  });

  it("T9 — InvalidQuoteTransitionError → 409", async () => {
    mockedTransitionQuoteStatus.mockRejectedValue(
      new InvalidQuoteTransitionError("draft", "expired"),
    );
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "expired",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "QUOTE_INVALID_TRANSITION" },
    });
  });

  it("T10 — null → INTERNAL_ERROR", async () => {
    mockedTransitionQuoteStatus.mockResolvedValue(null as never);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
  });

  it("T11 — zod fail bogus status", async () => {
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "bogus" as never,
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("T12 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(
      transitionQuoteStatusAction("quote-1", { targetStatus: "sent" }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("T12b — revalidatePath ×2", async () => {
    mockedTransitionQuoteStatus.mockResolvedValue({
      ...mockQuote,
      status: "sent",
    } as never);
    await transitionQuoteStatusAction("quote-1", { targetStatus: "sent" });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/quotes");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/admin/quotes/quote-1");
  });

  it("T12c — 5 statuses accepted by schema", async () => {
    const { transitionStatusSchema } = await import(
      "@/lib/schemas/quote.schemas"
    );
    for (const s of ["draft", "sent", "accepted", "declined", "expired"]) {
      const result = transitionStatusSchema.safeParse({ targetStatus: s });
      expect(result.success).toBe(true);
    }
  });

  it("sent_without_profile_returns_business_profile_required", async () => {
    mockedGetBusinessProfile.mockResolvedValue(null);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "BUSINESS_PROFILE_REQUIRED", status: 400 },
    });
    expect(mockedTransitionQuoteStatus).not.toHaveBeenCalled();
  });

  it("draft_to_sent_generates_pdf", async () => {
    const sentQuote = { ...mockQuote, status: "sent" };
    mockedTransitionQuoteStatus.mockResolvedValue(sentQuote as never);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({ ok: true, data: sentQuote });
    expect(mockedGenerateAndStoreQuotePdf).toHaveBeenCalledTimes(1);
    expect(mockedGenerateAndStoreQuotePdf).toHaveBeenCalledWith("quote-1");
  });

  it("pdf_generation_failure_does_not_block_emission", async () => {
    const sentQuote = { ...mockQuote, status: "sent" };
    mockedTransitionQuoteStatus.mockResolvedValue(sentQuote as never);
    mockedGenerateAndStoreQuotePdf.mockRejectedValue(new Error("R2 timeout"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({ ok: true });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = consoleSpy.mock.calls[0][0] as string;
    expect(logged).toContain("quote.pdf.generation_failed");
    consoleSpy.mockRestore();
  });

  it("non_sent_transition_skips_precheck_and_pdf", async () => {
    const acceptedQuote = { ...mockQuote, status: "accepted" };
    mockedTransitionQuoteStatus.mockResolvedValue(acceptedQuote as never);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "accepted",
    });
    expect(result).toMatchObject({ ok: true, data: acceptedQuote });
    expect(mockedGetBusinessProfile).not.toHaveBeenCalled();
    expect(mockedGenerateAndStoreQuotePdf).not.toHaveBeenCalled();
  });

  it("sent_precheck_quote_not_found", async () => {
    mockedGetQuoteById.mockResolvedValue(null);
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "INTERNAL_ERROR" },
    });
    expect(mockedTransitionQuoteStatus).not.toHaveBeenCalled();
  });
});

// --- getQuoteByIdAction (T13-T15) ---

describe("getQuoteByIdAction", () => {
  it("T13 — found", async () => {
    mockedGetQuoteById.mockResolvedValue(mockQuote as never);
    const result = await getQuoteByIdAction("quote-1");
    expect(result).toEqual({ ok: true, data: mockQuote });
  });

  it("T14 — not found (null)", async () => {
    mockedGetQuoteById.mockResolvedValue(null);
    const result = await getQuoteByIdAction("quote-999");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("T15 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(getQuoteByIdAction("quote-1")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
  });

  it("T15b — no revalidatePath", async () => {
    mockedGetQuoteById.mockResolvedValue(mockQuote as never);
    await getQuoteByIdAction("quote-1");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

// --- listQuotesAction (T16-T20) ---

describe("listQuotesAction", () => {
  it("T16 — sans opts", async () => {
    mockedListQuotes.mockResolvedValue([mockQuote] as never);
    const result = await listQuotesAction();
    expect(result).toEqual({ ok: true, data: [mockQuote] });
    expect(mockedListQuotes).toHaveBeenCalledWith(undefined);
  });

  it("T17 — clientId filter", async () => {
    mockedListQuotes.mockResolvedValue([mockQuote] as never);
    await listQuotesAction({ clientId: VALID_UUID });
    expect(mockedListQuotes).toHaveBeenCalledWith({ clientId: VALID_UUID });
  });

  it("T18 — status single", async () => {
    mockedListQuotes.mockResolvedValue([] as never);
    await listQuotesAction({ status: "draft" });
    expect(mockedListQuotes).toHaveBeenCalledWith({ status: "draft" });
  });

  it("T19 — status array", async () => {
    mockedListQuotes.mockResolvedValue([] as never);
    await listQuotesAction({ status: ["draft", "sent"] });
    expect(mockedListQuotes).toHaveBeenCalledWith({
      status: ["draft", "sent"],
    });
  });

  it("T20 — non-admin redirect", async () => {
    mockedRequireAdmin.mockRejectedValue(makeRedirectError());
    await expect(listQuotesAction()).rejects.toThrow("NEXT_REDIRECT");
  });
});

// --- handleActionError cross (T21-T25) ---

describe("handleActionError cross", () => {
  it("T21 — withAdmin wraps createQuoteAction", async () => {
    mockedCreateQuote.mockRejectedValue(new Error("random"));
    const result = await createQuoteAction({ clientId: VALID_UUID });
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });

  it("T22 — withAdmin wraps updateQuoteAction", async () => {
    mockedUpdateQuote.mockRejectedValue(new Error("random"));
    const result = await updateQuoteAction("quote-1", { notes: "x" });
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });

  it("T23 — withAdmin wraps transitionQuoteStatusAction", async () => {
    mockedTransitionQuoteStatus.mockRejectedValue(new Error("random"));
    const result = await transitionQuoteStatusAction("quote-1", {
      targetStatus: "sent",
    });
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });

  it("T24 — withAdmin wraps getQuoteByIdAction", async () => {
    mockedGetQuoteById.mockRejectedValue(new Error("random"));
    const result = await getQuoteByIdAction("quote-1");
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });

  it("T25 — withAdmin wraps listQuotesAction", async () => {
    mockedListQuotes.mockRejectedValue(new Error("random"));
    const result = await listQuotesAction();
    expect(result).toMatchObject({ ok: false, error: { code: "INTERNAL_ERROR" } });
  });
});
