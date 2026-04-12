import { DateTime } from "luxon";

/**
 * Parse a date/timestamp from the database, handling two formats:
 *  - ISO 8601 with T/Z:  "2024-01-15T10:30:00.000Z"  (from JS toISOString())
 *  - SQLite datetime():  "2024-01-15 10:30:00"        (space-separated, implicitly UTC)
 *  - Date-only:          "2024-01-15"                 (SQLite/LLM, no time component)
 *
 * Full datetimes are stored as UTC and converted to local time for display,
 * so the server's TZ environment variable (e.g. TZ=Europe/Berlin in Docker)
 * controls the displayed timezone. Date-only values have no time component
 * and are shown exactly as stored — no timezone shift applied.
 */
function parseDbDate(value: string): DateTime {
  if (value.includes("T")) {
    // Full ISO datetime: parse as UTC, convert to local zone for display
    return DateTime.fromISO(value, { zone: "utc" }).toLocal();
  }
  if (value.includes(" ")) {
    // SQLite datetime('now') format: UTC, convert to local zone for display
    return DateTime.fromSQL(value, { zone: "utc" }).toLocal();
  }
  // Date-only (YYYY-MM-DD): no time component, display exactly as-is
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
