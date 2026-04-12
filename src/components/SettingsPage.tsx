"use client";

import type { ReactNode } from "react";

export type SettingsToggle = {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
};

export type SettingsPageProps = {
  title?: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;

  /** Shown in the overview strip alongside paths. */
  documentCount: number;

  dataDir: string;
  originalsDir: string;
  ingestDir: string;
  thumbnailsDir: string;
  dbPath: string;

  ocrModel: string;
  metadataModel: string;

  openaiBaseUrl: string;
  /** When false, the API key row shows a “not configured” state instead of a masked value. */
  apiKeyConfigured: boolean;
  port: number;

  toggles?: SettingsToggle[];
  onToggleChange?: (id: string, enabled: boolean) => void;

  /** Extra blocks below the main sections (e.g. a static processing queue preview in Storybook). */
  appendix?: ReactNode;

  /** Renders the destructive panel at the bottom (buttons are non-functional unless wired). */
  showDangerZone?: boolean;
  onResetIndex?: () => void;
  onClearQueue?: () => void;
};

function OverviewPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  hint,
  monospace,
}: {
  id: string;
  label: string;
  value: string;
  hint?: string;
  monospace?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        readOnly
        value={value}
        className={`w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 shadow-inner outline-none ring-blue-500/20 focus-visible:ring-2 ${monospace ? "font-mono text-[13px] leading-snug" : ""}`}
      />
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-neutral-500">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  toggle,
  onToggle,
}: {
  toggle: SettingsToggle;
  onToggle?: (id: string, next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-neutral-100 pt-4 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-neutral-900">{toggle.label}</p>
        {toggle.description ? (
          <p className="mt-0.5 text-xs text-neutral-500">
            {toggle.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={toggle.enabled}
        onClick={() => onToggle?.(toggle.id, !toggle.enabled)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
          toggle.enabled ? "bg-blue-600" : "bg-neutral-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-6 w-6 translate-x-0.5 translate-y-0.5 rounded-full bg-white shadow transition ${
            toggle.enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPage({
  title = "Settings",
  subtitle = "Storage locations, model endpoints, and behavior for ingestion and search. Changes here are illustrative until wired to configuration.",
  backLabel = "← Back to search",
  onBack,

  documentCount,

  dataDir,
  originalsDir,
  ingestDir,
  thumbnailsDir,
  dbPath,

  ocrModel,
  metadataModel,

  openaiBaseUrl,
  apiKeyConfigured,
  port,

  toggles = [],
  onToggleChange,

  appendix,

  showDangerZone = true,
  onResetIndex,
  onClearQueue,
}: SettingsPageProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-zinc-50 px-6 py-10">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
      >
        {backLabel}
      </button>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {title}
        </h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <OverviewPill
          label="Indexed documents"
          value={`${documentCount.toLocaleString()} in database`}
        />
        <OverviewPill label="HTTP port" value={String(port)} />
        <OverviewPill label="LLM endpoint" value="OpenAI-compatible" />
      </div>

      <Section
        title="Storage"
        description="Resolved paths for the data directory, originals, ingest drop folder, thumbnails cache, and SQLite database file."
      >
        <div className="flex flex-col gap-4">
          <Field
            id="settings-data-dir"
            label="Data directory"
            value={dataDir}
            monospace
            hint="Base volume; Docker typically mounts a single DATA_DIR."
          />
          <Field
            id="settings-originals"
            label="Originals"
            value={originalsDir}
            monospace
          />
          <Field
            id="settings-ingest"
            label="Ingest"
            value={ingestDir}
            monospace
          />
          <Field
            id="settings-thumbnails"
            label="Thumbnails"
            value={thumbnailsDir}
            monospace
          />
          <Field
            id="settings-db"
            label="Database file"
            value={dbPath}
            monospace
          />
        </div>
      </Section>

      <Section
        title="Models"
        description="Vision-language model for OCR and a text model for metadata extraction. Values mirror environment-based configuration."
      >
        <div className="flex flex-col gap-4">
          <Field
            id="settings-ocr-model"
            label="OCR / VLM model"
            value={ocrModel}
            monospace
            hint="Used during ingest for page text and structure."
          />
          <Field
            id="settings-metadata-model"
            label="Metadata model"
            value={metadataModel}
            monospace
            hint="Summaries, titles, and dates applied after OCR."
          />
        </div>
      </Section>

      <Section
        title="API & networking"
        description="OpenAI-compatible base URL, API key, and the port the app listens on."
      >
        <div className="flex flex-col gap-4">
          <Field
            id="settings-openai-url"
            label="Base URL"
            value={openaiBaseUrl}
            monospace
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">
              API key
            </span>
            {apiKeyConfigured ? (
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-sm tracking-widest text-neutral-800 shadow-inner">
                <span aria-hidden="true">••••••••••••••••</span>
                <span className="text-xs font-sans tracking-normal text-emerald-700">
                  Configured
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Not configured — set OPENROUTER_KEY or OPENAI_* in the
                environment.
              </div>
            )}
          </div>
          <Field
            id="settings-port"
            label="Port"
            value={String(port)}
            hint="Application listen port (e.g. 3000)."
          />
        </div>
      </Section>

      {toggles.length > 0 ? (
        <Section
          title="Behavior"
          description="Feature flags for ingest and search. These controls are visual placeholders for upcoming configuration."
        >
          <div className="flex flex-col gap-0">
            {toggles.map((toggle) => (
              <ToggleRow
                key={toggle.id}
                toggle={toggle}
                onToggle={onToggleChange}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {appendix}

      {showDangerZone ? (
        <section className="rounded-2xl border border-red-200 bg-red-50/80 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-red-900">Danger zone</h2>
          <p className="mt-1 text-sm text-red-800/90">
            Destructive actions affect your archive and cannot be undone from
            the UI alone.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onResetIndex}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100"
            >
              Rebuild search index
            </button>
            <button
              type="button"
              onClick={onClearQueue}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100"
            >
              Clear processing queue
            </button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
