import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DocumentCard } from "./DocumentCard";

const meta = {
  title: "Components/DocumentCard",
  component: DocumentCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: { onClick: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 240 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DocumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PDF: Story = {
  args: {
    id: 42,
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    mimeType: "application/pdf",
  },
};

export const Image: Story = {
  args: {
    id: 5,
    title: "Kitchen renovation receipt",
    description: "Receipt from Bauhaus for kitchen counter materials.",
    documentDate: "2026-02-20",
    mimeType: "image/jpeg",
  },
};

export const Other: Story = {
  args: {
    id: 18,
    title: "Apartment Lease Agreement — 2025",
    description:
      "Rental contract for the apartment at Berliner Str. 42, signed December 2024.",
    documentDate: "2024-12-01",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

/* --- Theme-review states --- */

/** Arrow-key selection: the accent border plus ring must read as selection. */
export const KeyboardFocused: Story = {
  args: { ...PDF.args, isKeyboardFocused: true },
};

/** Thumbnail requested but unavailable — the recessed mount and icon show. */
export const ThumbnailUnavailable: Story = {
  args: { ...PDF.args, thumbnailUrl: "/api/documents/42/thumbnail" },
};

/** Search-hit wash inside a card. */
export const HighlightedSnippet: Story = {
  args: {
    ...PDF.args,
    snippet:
      "Monthly mobile service [[[invoice]]] from Deutsche [[[Telekom]]] covering the March 2026 billing period, including roaming and data usage charges for two lines.",
  },
};

/** Row variant used by list layouts — wider decorator than the grid card. */
export const ListVariant: Story = {
  args: {
    ...PDF.args,
    variant: "list",
    snippet:
      "Monthly mobile service [[[invoice]]] from Deutsche [[[Telekom]]] for the billing period March 2026.",
  },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
};
