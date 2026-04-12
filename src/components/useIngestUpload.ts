"use client";

import { useCallback, useState } from "react";

export type UploadNotice = {
  kind: "success" | "error";
  message: string;
} | null;

type UploadResponse = {
  files: Array<{
    originalFilename: string;
    relativePath: string;
    storedFilename: string;
  }>;
  uploadedCount: number;
};

function buildSuccessMessage(uploadedCount: number) {
  return uploadedCount === 1
    ? "Uploaded 1 file to ingest/. Processing will start automatically."
    : `Uploaded ${uploadedCount} files to ingest/. Processing will start automatically.`;
}

async function uploadToIngest(files: File[]) {
  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/upload", {
    body: formData,
    method: "POST",
  });

  const body = (await response.json()) as
    | UploadResponse
    | {
        message?: string;
      };

  if (!response.ok) {
    const message =
      "message" in body && typeof body.message === "string"
        ? body.message
        : "Upload failed";
    throw new Error(message);
  }

  return body as UploadResponse;
}

export function useIngestUpload({
  onUploadComplete,
}: {
  onUploadComplete?: (result: UploadResponse) => void | Promise<void>;
} = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<UploadNotice>(null);

  const uploadFiles = useCallback(
    async (files: File[] | FileList | null | undefined) => {
      const nextFiles = Array.from(files ?? []);

      if (isUploading || nextFiles.length === 0) {
        return;
      }

      setIsUploading(true);
      setNotice(null);

      try {
        const result = await uploadToIngest(nextFiles);
        setNotice({
          kind: "success",
          message: buildSuccessMessage(result.uploadedCount),
        });
        await onUploadComplete?.(result);
      } catch (error) {
        setNotice({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Unable to upload file",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, onUploadComplete],
  );

  return {
    isUploading,
    notice,
    uploadFiles,
  };
}
