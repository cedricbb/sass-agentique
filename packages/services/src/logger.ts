import { env } from "@saas/config";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function serializeContext(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: LogLevel, msg: string, ctx?: LogContext): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[env.LOG_LEVEL as LogLevel]) {
    return;
  }
  const payload = {
    level,
    timestamp: new Date().toISOString(),
    message: msg,
    ...serializeContext(ctx ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "warn") {
    console.warn(line);
  } else if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  debug(msg: string, ctx?: LogContext): void {
    emit("debug", msg, ctx);
  },
  info(msg: string, ctx?: LogContext): void {
    emit("info", msg, ctx);
  },
  warn(msg: string, ctx?: LogContext): void {
    emit("warn", msg, ctx);
  },
  error(msg: string, ctx?: LogContext): void {
    emit("error", msg, ctx);
  },
};
