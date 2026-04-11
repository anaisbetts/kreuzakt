import { NextResponse } from "next/server";

export function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export function parsePositiveInt(
  value: string | null,
  fallback: number,
  {
    min = 1,
    max,
  }: {
    min?: number;
    max?: number;
  } = {},
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < min) {
    return null;
  }

  if (max != null && parsed > max) {
    return max;
  }

  return parsed;
}
