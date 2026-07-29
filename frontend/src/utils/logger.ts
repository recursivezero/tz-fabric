export type LogContext = Readonly<
  Record<string, string | number | boolean | null | undefined>
>;

type SafeError = {
  name: string;
  message: string;
};

const loggingEnabled = import.meta.env.DEV;

function normaliseError(error: unknown): SafeError | undefined {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }

  if (typeof error === "string" && error.trim()) {
    return { name: "Error", message: error };
  }

  return undefined;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!loggingEnabled) return;
    console.debug(message, context ?? {});
  },

  warn(message: string, error?: unknown, context?: LogContext): void {
    if (!loggingEnabled) return;
    console.warn(message, normaliseError(error), context ?? {});
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (!loggingEnabled) return;
    console.error(message, normaliseError(error), context ?? {});
  },
};
