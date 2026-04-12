import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ProcessingQueue } from "./ProcessingQueue";
import { SettingsPage } from "./SettingsPage";

const mockPaths = {
  dataDir: "/home/docs-ai/data",
  originalsDir: "/home/docs-ai/data/originals",
  ingestDir: "/home/docs-ai/data/ingest",
  thumbnailsDir: "/home/docs-ai/data/thumbnails",
  dbPath: "/home/docs-ai/data/docs-ai.db",
};

const mockModels = {
  ocrModel: "openai/gpt-5.4-mini",
  metadataModel: "openai/gpt-5.4",
};

const mockApi = {
  openaiBaseUrl: "https://openrouter.ai/api/v1",
  port: 3000,
};

const mockToggles = [
  {
    id: "thumbnails",
    label: "Generate page thumbnails",
    description:
      "Create JPEG previews for the grid and viewer. Disable to speed up ingest on slow disks.",
    enabled: true,
  },
  {
    id: "metadata",
    label: "LLM metadata extraction",
    description:
      "Infer title, description, and document date after OCR. Uses the metadata model above.",
    enabled: true,
  },
  {
    id: "mcp",
    label: "Expose MCP server",
    description:
      "Allow IDE tools to query documents over the local MCP endpoint when the app is running.",
    enabled: false,
  },
  {
    id: "watch-ingest",
    label: "Watch ingest folder",
    description:
      "Automatically queue new files dropped into the ingest directory.",
    enabled: true,
  },
];

const mockQueueEntries = [
  {
    id: 104,
    filename: "invoices/april_2026.pdf",
    status: "processing" as const,
    error: null,
    document_id: null,
    created_at: new Date(Date.now() - 15_000).toISOString(),
    completed_at: null,
  },
  {
    id: 103,
    filename: "contracts/lease_addendum.pdf",
    status: "pending" as const,
    error: null,
    document_id: null,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    completed_at: null,
  },
  {
    id: 102,
    filename: "receipts/kitchen.jpg",
    status: "completed" as const,
    error: null,
    document_id: 42,
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 101,
    filename: "blurry_scan.jpg",
    status: "failed" as const,
    error: "OCR extraction timed out after 30 seconds",
    document_id: null,
    created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 9 * 60_000).toISOString(),
  },
  {
    id: 100,
    filename: "telekom_march.pdf",
    status: "completed" as const,
    error: null,
    document_id: 41,
    created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    completed_at: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
];

const mockQueueCounts = {
  pending: 2,
  processing: 1,
  completed: 12,
  failed: 1,
};

const mockQueueAppendix = (
  <ProcessingQueue
    enablePolling={false}
    initialCounts={mockQueueCounts}
    initialEntries={mockQueueEntries}
  />
);

const meta = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  parameters: { layout: "fullscreen" },
  args: {
    onBack: fn(),
    onToggleChange: fn(),
    onResetIndex: fn(),
    onClearQueue: fn(),
    documentCount: 1284,
    apiKeyConfigured: true,
    toggles: mockToggles,
    appendix: mockQueueAppendix,
    ...mockPaths,
    ...mockModels,
    ...mockApi,
  },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Full layout: overview pills, storage, models, API, behavior toggles, static
 * processing queue (no polling), and danger zone.
 */
export const Default: Story = {};

/** Form sections only — omit the queue when iterating on settings chrome. */
export const FormOnly: Story = {
  args: {
    appendix: undefined,
  },
};

/** API key missing — shows the dashed warning instead of a masked secret. */
export const ApiKeyNotConfigured: Story = {
  args: {
    apiKeyConfigured: false,
  },
};

/** Compact variant for narrow viewports or documentation screenshots. */
export const WithoutDangerZone: Story = {
  args: {
    showDangerZone: false,
    toggles: mockToggles.slice(0, 2),
  },
};
