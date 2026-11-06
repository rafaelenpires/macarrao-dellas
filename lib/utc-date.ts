export function databaseTimestampToIso(value: unknown): string {
  const text = String(value ?? "");
  const withTimezone = /[zZ]|[+-]\d\d:\d\d$/.test(text)
    ? text
    : `${text.replace(" ", "T")}Z`;
  const date = new Date(withTimezone);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}
