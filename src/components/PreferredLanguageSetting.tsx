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
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="section-title">Preferred Language</h2>
        <p className="text-sm text-ink-mute">
          When creating descriptions, create descriptions in the specified
          language regardless of the document&apos;s language. If unset,
          descriptions will be in the language of the document.
        </p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-soft">
            Preferred Language
          </span>
          <input
            type="text"
            name="preferredLanguage"
            value={preferredLanguage}
            onChange={(event) => setPreferredLanguageValue(event.target.value)}
            placeholder="e.g. German, English, fr"
            className="field"
          />
        </label>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={isSaving || !hasChanges}
            className="btn btn-primary px-4 py-3"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>

      {message ? (
        <div className="rounded-card border border-success-line bg-success-tint px-4 py-3 text-sm text-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-card border border-danger-line bg-danger-tint px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
    </section>
  );
}
