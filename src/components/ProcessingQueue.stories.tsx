import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ProcessingQueue } from "./ProcessingQueue";

const meta = {
  title: "Components/ProcessingQueue",
  component: ProcessingQueue,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProcessingQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
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
};

export const Empty: Story = {
  args: {
    initialCounts: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    },
    initialEntries: [],
  },
};
