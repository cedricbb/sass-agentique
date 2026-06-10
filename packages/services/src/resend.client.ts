import { Resend } from "resend";
import { createHash } from "crypto";
import { env } from "@saas/config";

let _resendClient: Resend | null = null;
let _resendClientKeyHash: string | null = null;

function hashResendKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function getResendClient(): Resend {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  const currentHash = hashResendKey(apiKey);
  if (!_resendClient || _resendClientKeyHash !== currentHash) {
    _resendClient = new Resend(apiKey);
    _resendClientKeyHash = currentHash;
  }
  return _resendClient;
}

export function __resetResendClientForTests(): void {
  _resendClient = null;
  _resendClientKeyHash = null;
}

export function __getResendClientKeyHashForTests(): string | null {
  return _resendClientKeyHash;
}
