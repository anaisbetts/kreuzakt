"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-ink">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <h1 className="font-display text-xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          {error.message ||
            "An unexpected error occurred while loading this page."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="btn btn-primary mt-6 px-4 py-2"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
