import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api";
import { ensurePendingQueueEntry } from "@/lib/ingest/queue";
import { enqueueQueuedFile } from "@/lib/ingest/watcher";
import { writeUploadToIngest } from "@/lib/uploads";

export const runtime = "nodejs";

function getUploadedFiles(formData: FormData) {
  return formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = getUploadedFiles(formData);

  if (files.length === 0) {
    return jsonError(
      400,
      "bad_request",
      "Upload requests must include at least one file",
    );
  }

  try {
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const stored = await writeUploadToIngest(file);
        const queueEntry = await ensurePendingQueueEntry(stored.relativePath);
        if (!queueEntry) {
          throw new Error("Unable to create queue entry for uploaded file");
        }
        await enqueueQueuedFile(stored.relativePath, queueEntry.id);

        return {
          originalFilename: file.name,
          relativePath: stored.relativePath,
          storedFilename: stored.storedFilename,
        };
      }),
    );

    return NextResponse.json(
      {
        files: uploadedFiles,
        uploadedCount: uploadedFiles.length,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("upload failed", error);
    return jsonError(500, "internal_error", "Unable to save uploaded file");
  }
}
