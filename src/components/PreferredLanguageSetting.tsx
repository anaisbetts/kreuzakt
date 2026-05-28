"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type PreferredLanguageSettingProps = {
  initialPreferredLanguage: string | null;
};

export function PreferredLanguageSetting({
  initialPreferredLanguage,
}: PreferredLanguageSettingProps) {
  const [preferredLanguage, setPreferredLanguageValue] = useState(
    initialPreferredLanguage ?? "",
  );
  const [savedPreferredLanguage, setSavedPreferredLanguage] = useState(
    initialPreferredLanguage ?? "",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = preferredLanguage !== savedPreferredLanguage;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || !hasChanges) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLanguage }),
      });

      const body = (await response.json()) as {
        preferredLanguage?: string | null;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(body.message ?? "Unable to save preferred language");
      }

      const nextValue = body.preferredLanguage ?? "";
      setPreferredLanguageValue(nextValue);
      setSavedPreferredLanguage(nextValue);
      setMessage(
        nextValue ? "Preferred language saved." : "Preferred language cleared.",
      );
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save preferred language",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          Preferred Language
        </h2>
        <p className="text-sm text-neutral-500">
          When creating descriptions, create descriptions in the specified
          language regardless of the document&apos;s language. If unset,
          descriptions will be in the language of the document.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">
            Preferred Language
          </span>
          <input
            type="text"
            name="preferredLanguage"
            value={preferredLanguage}
            onChange={(event) => setPreferredLanguageValue(event.target.value)}
            placeholder="e.g. German, English, fr"
            className="rounded-xl border border-neutral-300 px-4 py-3 text-sm text-neutral-900 outline-none transition-colors focus:border-blue-500"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving || !hasChanges}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}
