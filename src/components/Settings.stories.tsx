import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SystemStatusPage } from "./SystemStatusPage";

const meta = {
  title: "Pages/Settings",
  component: SystemStatusPage,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SystemStatusPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    documentCount: 1284,
    originalsDisplay: "/home/kreuzakt/data/originals",
    ingestDisplay: "/home/kreuzakt/data/ingest",
    ocrModel: "openai/gpt-5.4-mini",
    metadataModel: "openai/gpt-5.4",
    llmEndpoint: "https://openrouter.ai/api/v1",
    queue: {
      enablePolling: false,
      initialCounts: {
        pending: 2,
        processing: 1,
        completed: 12,
        failed: 1,
      },
      initialEntries: [
        {
          id: 104,
          filename: "invoices/april_2026.pdf",
          status: "processing",
          error: null,
          document_id: null,
          created_at: new Date(Date.now() - 15_000).toISOString(),
          completed_at: null,
        },
        {
          id: 103,
          filename: "contracts/lease_addendum.pdf",
          status: "pending",
          error: null,
          document_id: null,
          created_at: new Date(Date.now() - 60_000).toISOString(),
          completed_at: null,
        },
        {
          id: 102,
          filename: "receipts/kitchen.jpg",
          status: "completed",
          error: null,
          document_id: 42,
          created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
          completed_at: new Date(Date.now() - 4 * 60_000).toISOString(),
        },
        {
          id: 101,
          filename: "blurry_scan.jpg",
          status: "failed",
          error: "OCR extraction timed out after 30 seconds",
          document_id: null,
          created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
          completed_at: new Date(Date.now() - 9 * 60_000).toISOString(),
        },
        {
          id: 100,
          filename: "telekom_march.pdf",
          status: "completed",
          error: null,
          document_id: 41,
          created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
          completed_at: new Date(Date.now() - 18 * 60_000).toISOString(),
        },
      ],
    },
  },
};

/** Same layout when paths are missing (mirrors live app when dirs are absent). */
export const MissingPaths: Story = {
  args: {
    ...Default.args,
    originalsDisplay: "Missing",
    ingestDisplay: "Missing",
  },
};
