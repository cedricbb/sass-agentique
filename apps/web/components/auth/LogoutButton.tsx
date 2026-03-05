"use client";

import { useRef } from "react";
import { logoutAction } from "@/app/actions/auth";
export function LogoutButton() {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <span
        className="cursor-pointer"
        onClick={() => formRef.current?.requestSubmit()}
      >
        Déconnexion
      </span>
      <form ref={formRef} action={logoutAction} className="hidden" />
    </>
  );
}
