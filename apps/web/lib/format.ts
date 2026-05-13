const FALLBACK = "—";
const FR_LOCALE = "fr-FR";
const PARIS_TZ = "Europe/Paris";

function toDate(input: Date | string | null | undefined): Date | null {
  if (input == null) return null;
  const d = typeof input === "string" ? new Date(input) : input;
  return isNaN(d.getTime()) ? null : d;
}

export function formatCurrency(
  amount: number | null | undefined,
  currency = "EUR",
): string {
  if (amount == null || !Number.isFinite(amount)) return FALLBACK;
  return new Intl.NumberFormat(FR_LOCALE, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(
  input: Date | string | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return FALLBACK;
  return new Intl.DateTimeFormat(FR_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(
  input: Date | string | null | undefined,
): string {
  const d = toDate(input);
  if (!d) return FALLBACK;
  return new Intl.DateTimeFormat(FR_LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: PARIS_TZ,
  }).format(d);
}

export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 0,
): string {
  if (value == null || !Number.isFinite(value)) return FALLBACK;
  return new Intl.NumberFormat(FR_LOCALE, {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
