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

type UploadedFileResult = {
  originalFilename: string;
  relativePath: string;
  storedFilename: string;
};

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

  const outcomes = await Promise.allSettled(
    files.map(async (file): Promise<UploadedFileResult> => {
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

  const uploadedFiles: UploadedFileResult[] = [];
  const errors: Array<{ originalFilename: string; message: string }> = [];

  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    const file = files[i];
    if (outcome.status === "fulfilled") {
      uploadedFiles.push(outcome.value);
    } else {
      const reason = outcome.reason;
      console.error("upload item failed", reason);
      errors.push({
        originalFilename: file.name,
        message:
          reason instanceof Error
            ? reason.message
            : "Unable to save uploaded file",
      });
    }
  }

  if (uploadedFiles.length === 0) {
    const firstMessage = errors[0]?.message ?? "Unable to save uploaded file";
    return jsonError(500, "internal_error", firstMessage);
  }

  return NextResponse.json(
    {
      files: uploadedFiles,
      uploadedCount: uploadedFiles.length,
      failedCount: errors.length,
      errors,
    },
    { status: 201 },
  );
}
