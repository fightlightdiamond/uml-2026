export function log(event: string, fields: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || "lab",
    event,
    ...fields,
  };
  console.log(JSON.stringify(entry));
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
