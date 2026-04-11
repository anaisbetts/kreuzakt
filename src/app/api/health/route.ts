import { NextResponse } from "next/server";

import { appConfig } from "@/lib/config";
import { getDocumentCount } from "@/lib/documents";
import { ensureAppDirectories, fileExists } from "@/lib/files";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureAppDirectories();

    const [documents, originalsDir, ingestDir] = await Promise.all([
      getDocumentCount(),
      fileExists(appConfig.originalsDir),
      fileExists(appConfig.ingestDir),
    ]);

    return NextResponse.json({
      status: "ok",
      documents,
      database: true,
      originals_dir: originalsDir,
      ingest_dir: ingestDir,
      ocr_model: appConfig.ocrModel,
      metadata_model: appConfig.metadataModel,
      openai_base_url: appConfig.openaiBaseUrl,
    });
  } catch (error) {
    console.error("health check failed", error);

    return NextResponse.json(
      {
        error: "internal_error",
        message: "Health check failed",
      },
      { status: 500 },
    );
  }
}
