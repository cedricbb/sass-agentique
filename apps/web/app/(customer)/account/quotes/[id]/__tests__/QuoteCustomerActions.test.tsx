// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QuoteCustomerActions } from "../QuoteCustomerActions";

const mockAcceptAction = vi.fn();
const mockDeclineAction = vi.fn();

vi.mock("@/app/actions/customer-quotes", () => ({
  acceptCustomerQuoteAction: (...args: unknown[]) => mockAcceptAction(...args),
  declineCustomerQuoteAction: (...args: unknown[]) => mockDeclineAction(...args),
}));

vi.mock("@/lib/toast", () => ({
  toastResult: vi.fn(),
}));

import { toastResult } from "@/lib/toast";

const mockedToastResult = vi.mocked(toastResult);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("QuoteCustomerActions", () => {
  it("shows_accept_and_decline_buttons_when_status_sent", () => {
    render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="sent" />,
    );
    expect(screen.getByRole("button", { name: /accepter le devis/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refuser le devis/i })).toBeInTheDocument();
  });

  it("renders_nothing_when_status_not_sent", () => {
    const { container: c1 } = render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="accepted" />,
    );
    expect(c1.firstChild).toBeNull();
    cleanup();

    const { container: c2 } = render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="declined" />,
    );
    expect(c2.firstChild).toBeNull();
    cleanup();

    const { container: c3 } = render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="expired" />,
    );
    expect(c3.firstChild).toBeNull();
  });

  it("accept_button_calls_action_and_toasts_success", async () => {
    mockAcceptAction.mockResolvedValue({ ok: true, data: {} });

    render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="sent" />,
    );

    fireEvent.click(screen.getByTestId("quote-accept-trigger"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quote-accept-confirm"));

    await waitFor(() => {
      expect(mockAcceptAction).toHaveBeenCalledWith("q-1");
      expect(mockedToastResult).toHaveBeenCalled();
    });
  });

  it("decline_button_calls_action_and_toasts_success", async () => {
    mockDeclineAction.mockResolvedValue({ ok: true, data: {} });

    render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="sent" />,
    );

    fireEvent.click(screen.getByTestId("quote-decline-trigger"));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("quote-decline-confirm"));

    await waitFor(() => {
      expect(mockDeclineAction).toHaveBeenCalledWith("q-1");
      expect(mockedToastResult).toHaveBeenCalled();
    });
  });

  it("disables_buttons_while_pending", async () => {
    let resolveAction!: (v: unknown) => void;
    mockAcceptAction.mockReturnValue(new Promise((r) => { resolveAction = r; }));

    render(
      <QuoteCustomerActions quoteId="q-1" quoteNumber="Q-2026-001" status="sent" />,
    );

    fireEvent.click(screen.getByTestId("quote-accept-trigger"));
    fireEvent.click(screen.getByTestId("quote-accept-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("quote-accept-trigger")).toBeDisabled();
      expect(screen.getByTestId("quote-decline-trigger")).toBeDisabled();
    });

    await act(async () => {
      resolveAction({ ok: true, data: {} });
    });

    await waitFor(() => {
      expect(screen.getByTestId("quote-accept-trigger")).not.toBeDisabled();
    });
  });
});
