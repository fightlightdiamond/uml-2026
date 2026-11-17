export function log(event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: process.env.SERVICE_NAME || "lab",
    event,
    ...fields,
  };
  console.log(JSON.stringify(entry));
}
