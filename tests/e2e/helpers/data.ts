export const SEED_CLIENT_NAME = "Acme Studio";

export function uniqueProjectName(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
