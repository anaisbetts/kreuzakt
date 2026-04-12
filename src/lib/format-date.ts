import { DateTime } from "luxon";

/**
 * Parse a date/timestamp from the database, handling two formats:
 *  - ISO 8601 with T/Z:  "2024-01-15T10:30:00.000Z"  (from JS toISOString())
 *  - SQLite datetime():  "2024-01-15 10:30:00"        (space-separated, implicitly UTC)
 *  - Date-only:          "2024-01-15"                 (SQLite/LLM, no time component)
 *
 * new Date() misparses the SQLite space format as local time, and misparses
 * date-only strings as midnight UTC which then shifts the display day in
 * non-UTC timezones. This always treats the value as UTC.
 */
function parseDbDate(value: string): DateTime {
  if (value.includes("T")) {
    return DateTime.fromISO(value, { zone: "utc" });
  }
  if (value.includes(" ")) {
    return DateTime.fromSQL(value, { zone: "utc" });
  }
  // Date-only: YYYY-MM-DD
  return DateTime.fromISO(value, { zone: "utc" });
}

export function formatDateShort(value: string): string {
  return parseDbDate(value).toLocaleString(DateTime.DATE_MED);
}

export function formatDateLong(value: string): string {
  return parseDbDate(value).toLocaleString(DateTime.DATE_FULL);
}

export function formatRelativeTime(value: string | null): string {
  if (!value) return "Not finished";
  return parseDbDate(value).toRelative() ?? formatDateShort(value);
}
