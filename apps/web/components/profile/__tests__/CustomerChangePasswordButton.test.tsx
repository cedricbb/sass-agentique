// @vitest-environment jsdom
import React, { useActionState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockFormAction = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn() };
});

vi.mock("@/app/actions/customer-profile", () => ({
  changeCustomerPasswordAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn() },
}));

import { CustomerChangePasswordButton } from "../CustomerChangePasswordButton";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useActionState).mockReturnValue([null, mockFormAction, false]);
  Element.prototype.scrollIntoView = vi.fn();
  (window.HTMLElement.prototype as unknown as Record<string, unknown>).hasPointerCapture = vi.fn();
  (window.HTMLElement.prototype as unknown as Record<string, unknown>).releasePointerCapture = vi.fn();
});
afterEach(cleanup);

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /changer le mot de passe/i }));
  await waitFor(() => screen.getByRole("dialog"));
}

describe("CustomerChangePasswordButton", () => {
  it("calls_change_password_action_on_submit", async () => {
    render(<CustomerChangePasswordButton />);
    await openDialog();

    const form = screen.getByRole("dialog").querySelector("form");
    expect(form).toBeTruthy();

    fireEvent.submit(form!);
    expect(mockFormAction).toHaveBeenCalled();
  })
})
