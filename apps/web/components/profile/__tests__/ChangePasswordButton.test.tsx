// @vitest-environment jsdom
import React, { useActionState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockFormAction = vi.fn();

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: vi.fn() };
});

vi.mock("@/app/actions/profile", () => ({
  changeAdminPasswordAction: vi.fn(),
}));

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn() },
}));

import { ChangePasswordButton } from "../ChangePasswordButton";
import { toast } from "@/lib/toast";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useActionState).mockReturnValue([null, mockFormAction, false]);
  Element.prototype.scrollIntoView = vi.fn();
  (window.HTMLElement.prototype as unknown as Record<string, unknown>).hasPointerCapture = vi.fn();
  (window.HTMLElement.prototype as unknown as Record<string, unknown>).releasePointerCapture = vi.fn();
});
afterEach(cleanup);

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /modifier le mot de passe/i }));
  await waitFor(() => screen.getByRole("dialog"));
}

describe("ChangePasswordButton", () => {
  it("renders_trigger_button_and_opens_dialog_with_password_fields", async () => {
    render(<ChangePasswordButton />);
    expect(screen.getByRole("button", { name: /modifier le mot de passe/i })).toBeInTheDocument();
    await openDialog();
    const oldPwd = screen.getByLabelText("Mot de passe actuel");
    const newPwd = screen.getByLabelText("Nouveau mot de passe");
    const confirm = screen.getByLabelText("Confirmer le nouveau mot de passe");
    expect(oldPwd).toHaveAttribute("type", "password");
    expect(newPwd).toHaveAttribute("type", "password");
    expect(confirm).toHaveAttribute("type", "password");
    expect(oldPwd).toHaveAttribute("name", "oldPassword");
    expect(newPwd).toHaveAttribute("name", "newPassword");
    expect(confirm).toHaveAttribute("name", "confirmNewPassword");
  });

  it("submits_form_calls_change_admin_password_action", async () => {
    render(<ChangePasswordButton />);
    await openDialog();
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(mockFormAction).toHaveBeenCalled());
  });

  it("displays_inline_error_on_action_failure", async () => {
    vi.mocked(useActionState).mockReturnValue([
      { error: "Mot de passe actuel incorrect" },
      mockFormAction,
      false,
    ]);
    render(<ChangePasswordButton />);
    await openDialog();
    expect(screen.getByText("Mot de passe actuel incorrect")).toBeInTheDocument();
  });

  it("closes_dialog_on_success", async () => {
    const { rerender } = render(<ChangePasswordButton />);
    await openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    vi.mocked(useActionState).mockReturnValue([null, mockFormAction, true]);
    rerender(<ChangePasswordButton />);

    vi.mocked(useActionState).mockReturnValue([null, mockFormAction, false]);
    rerender(<ChangePasswordButton />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows_success_toast_on_password_change", async () => {
    const { rerender } = render(<ChangePasswordButton />);
    await openDialog();

    vi.mocked(useActionState).mockReturnValue([null, mockFormAction, true]);
    rerender(<ChangePasswordButton />);

    vi.mocked(useActionState).mockReturnValue([null, mockFormAction, false]);
    rerender(<ChangePasswordButton />);

    await waitFor(() => expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Mot de passe modifié"));
  });

  it("all_inputs_have_type_password", async () => {
    render(<ChangePasswordButton />);
    await openDialog();
    const inputs = screen.getAllByDisplayValue("");
    const passwordInputs = inputs.filter(
      (el) => el.getAttribute("type") === "password",
    );
    expect(passwordInputs).toHaveLength(3);
    const textInputs = inputs.filter((el) => el.getAttribute("type") === "text");
    expect(textInputs).toHaveLength(0);
  });

  it("submit_button_disabled_while_pending", async () => {
    vi.mocked(useActionState).mockReturnValue([null, mockFormAction, true]);
    render(<ChangePasswordButton />);
    await openDialog();
    const submitBtn = document.querySelector("button[type='submit']");
    expect(submitBtn).toBeDisabled();
  });
});
