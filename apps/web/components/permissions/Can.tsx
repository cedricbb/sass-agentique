"use client";

import type { ReactNode } from "react";
import type { Action, Subject } from "@saas/permissions";
import { useAbility } from "../../hooks/useAbility";

export function Can({
  action,
  subject,
  children,
}: {
  action: Action;
  subject: Subject;
  children: ReactNode;
}): ReactNode {
  const ability = useAbility();
  return ability.can(action, subject) ? children : null;
}
