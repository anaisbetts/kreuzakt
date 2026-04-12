"use client";

import { useCallback, useRef, useState } from "react";

export type UploadNotice = {
  kind: "success" | "error";
  message: string;
} | null;

export type UploadResponse = {
  files: Array<{
    originalFilename: string;
    relativePath: string;
    storedFilename: string;
  }>;
  uploadedCount: number;
  failedCount?: number;
  errors?: Array<{ originalFilename: string; message: string }>;
};

function buildSuccessMessage(result: UploadResponse) {
  const { uploadedCount, failedCount = 0 } = result;

  if (uploadedCount === 0) {
    return "No files were uploaded.";
  }

  const base =
    uploadedCount === 1
      ? "Uploaded 1 file to ingest/. Processing will start automatically."
      : `Uploaded ${uploadedCount} files to ingest/. Processing will start automatically.`;

  if (failedCount > 0) {
    const failedPart =
      failedCount === 1
        ? "1 file failed to upload."
        : `${failedCount} files failed to upload.`;
    return `${base} ${failedPart}`;
  }

  return base;
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
  const pendingQueueRef = useRef<File[]>([]);
  const isDrainingRef = useRef(false);

  const uploadFiles = useCallback(
    async (files: File[] | FileList | null | undefined) => {
      const nextFiles = Array.from(files ?? []);
      if (nextFiles.length === 0) {
        return;
      }

      pendingQueueRef.current.push(...nextFiles);

      if (isDrainingRef.current) {
        return;
      }

      isDrainingRef.current = true;
      setIsUploading(true);
      setNotice(null);

      try {
        while (pendingQueueRef.current.length > 0) {
          const batch = pendingQueueRef.current.splice(
            0,
            pendingQueueRef.current.length,
          );
          try {
            const result = await uploadToIngest(batch);
            setNotice({
              kind: "success",
              message: buildSuccessMessage(result),
            });
            await onUploadComplete?.(result);
          } catch (error) {
            setNotice({
              kind: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "Unable to upload file",
            });
          }
        }
      } finally {
        isDrainingRef.current = false;
        setIsUploading(false);
      }
    },
    [onUploadComplete],
  );

  return {
    isUploading,
    notice,
    uploadFiles,
  };
}
