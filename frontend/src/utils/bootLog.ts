const PREFIX = "[boot]";

export function bootLog(step: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.info(`${PREFIX} ${step}${payload}`);
}

export function bootWarn(step: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.warn(`${PREFIX} ${step}${payload}`);
}

export function bootError(step: string, error: unknown, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) {
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${PREFIX} ${step}`, { message, ...detail, error });
}
