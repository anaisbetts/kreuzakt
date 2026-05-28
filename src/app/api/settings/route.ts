import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { getPreferredLanguage, setPreferredLanguage } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const preferredLanguage = await getPreferredLanguage();
    return NextResponse.json({ preferredLanguage });
  } catch (error) {
    console.error("settings fetch failed", error);
    return jsonError(500, "internal_error", "Failed to fetch settings");
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { preferredLanguage?: unknown };

    if (
      body.preferredLanguage !== undefined &&
      typeof body.preferredLanguage !== "string"
    ) {
      return jsonError(
        400,
        "invalid_request",
        "preferredLanguage must be a string",
      );
    }

    const preferredLanguage = await setPreferredLanguage(
      typeof body.preferredLanguage === "string" ? body.preferredLanguage : "",
    );

    return NextResponse.json({ preferredLanguage });
  } catch (error) {
    console.error("settings update failed", error);
    return jsonError(500, "internal_error", "Failed to update settings");
  }
}
