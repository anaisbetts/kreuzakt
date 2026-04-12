"use client";

import { useRef } from "react";

export type UploadButtonProps = {
  disabled?: boolean;
  isUploading?: boolean;
  onFilesSelected?: (files: File[]) => void | Promise<void>;
};

export function UploadButton({
  disabled = false,
  isUploading = false,
  onFilesSelected,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = "";

          if (files.length === 0) {
            return;
          }

          void onFilesSelected?.(files);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className="flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V4.5m0 0L7.5 9m4.5-4.5L16.5 9M4.5 16.5v1.125A1.875 1.875 0 006.375 19.5h11.25a1.875 1.875 0 001.875-1.875V16.5"
          />
        </svg>
        <span>{isUploading ? "Uploading..." : "Upload"}</span>
      </button>
    </>
  );
}
