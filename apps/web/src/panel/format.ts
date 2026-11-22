export function flattenProperties(
  properties: Record<string, unknown>,
  prefix = "",
): [string, string][] {
  const rows: [string, string][] = [];
  for (const [key, value] of Object.entries(properties)) {
    const name = prefix === "" ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = flattenProperties(value as Record<string, unknown>, name);
      rows.push(...(nested.length === 0 ? [[name, "-"] as [string, string]] : nested));
    } else {
      rows.push([name, formatValue(value)]);
    }
  }
  return rows;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "-" : value.map(formatValue).join(", ");
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function safeUrl(url: string | null): string | undefined {
  if (url === null) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? isoTimestamp : dateFormat.format(date);
}
