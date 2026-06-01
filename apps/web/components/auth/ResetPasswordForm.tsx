"use client";

import { resetPasswordAction } from "../../app/actions/auth";
import { PasswordSetupForm } from "./PasswordSetupForm";

type Props = { token: string };

export function ResetPasswordForm({ token }: Props) {
  return (
    <PasswordSetupForm
      token={token}
      action={resetPasswordAction}
      submitLabel="Réinitialiser le mot de passe"
      pendingLabel="Réinitialisation…"
    />
  );
}
