/** fetch mit hartem Timeout — ein haengender ICS-Server darf das Dashboard nicht blockieren. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Kurze, lesbare Fehlermeldung fuer die Status-Pills in der UI. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') return 'Zeitueberschreitung';
    if (error.message.includes('ENOTFOUND')) return 'Host nicht erreichbar';
    if (error.message.includes('ECONNREFUSED')) return 'Verbindung abgelehnt';
    return error.message;
  }
  return String(error);
}
