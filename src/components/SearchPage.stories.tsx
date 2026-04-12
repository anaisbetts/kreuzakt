import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { SearchPage } from "./SearchPage";

const mockRecentDocuments = [
  {
    id: 42,
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    mimeType: "application/pdf",
  },
  {
    id: 41,
    title: "Apartment Lease Agreement",
    description:
      "Rental contract for the apartment at Berliner Str. 42, signed December 2024.",
    documentDate: "2024-12-01",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    id: 40,
    title: "Kitchen Renovation Receipt",
    description:
      "Receipt from Bauhaus for kitchen counter materials and installation.",
    documentDate: "2026-02-20",
    mimeType: "image/jpeg",
  },
  {
    id: 39,
    title: "Health Insurance Card — 2026",
    description:
      "Scanned copy of the AOK health insurance card, valid through December 2026.",
    documentDate: "2026-01-01",
    mimeType: "image/png",
  },
  {
    id: 38,
    title: "Deutsche Telekom Invoice — February 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period February 2026.",
    documentDate: "2026-02-15",
    mimeType: "application/pdf",
  },
  {
    id: 37,
    title: "Car Insurance Policy Renewal",
    description:
      "HUK-COBURG auto insurance renewal notice for the policy period 2026–2027.",
    documentDate: "2025-11-30",
    mimeType: "application/pdf",
  },
];

const mockSearchResults = [
  {
    id: 42,
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    mimeType: "application/pdf",
    snippet:
      "Monthly mobile service [[[invoice]]] from Deutsche [[[Telekom]]] covering the March 2026 billing period.",
  },
  {
    id: 38,
    title: "Deutsche Telekom Invoice — February 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period February 2026.",
    documentDate: "2026-02-15",
    mimeType: "application/pdf",
    snippet:
      "Your [[[Telekom]]] mobile plan [[[invoice]]] for February 2026 includes roaming and data usage charges.",
  },
  {
    id: 35,
    title: "Deutsche Telekom Invoice — January 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for January 2026.",
    documentDate: "2026-01-15",
    mimeType: "application/pdf",
    snippet:
      "January [[[invoice]]] summary for your Deutsche [[[Telekom]]] account, including service fees and taxes.",
  },
  {
    id: 31,
    title: "Deutsche Telekom Invoice — December 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for December 2025.",
    documentDate: "2025-12-15",
    mimeType: "application/pdf",
    snippet:
      "December [[[invoice]]] from [[[Telekom]]] showing device financing and the monthly mobile plan charge.",
  },
  {
    id: 28,
    title: "Deutsche Telekom Invoice — November 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for November 2025.",
    documentDate: "2025-11-15",
    mimeType: "application/pdf",
    snippet:
      "Archived [[[Telekom]]] [[[invoice]]] for November 2025 with the standard recurring service breakdown.",
  },
  {
    id: 25,
    title: "Deutsche Telekom Invoice — October 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for October 2025.",
    documentDate: "2025-10-15",
    mimeType: "application/pdf",
    snippet:
      "October 2025 [[[invoice]]] from Deutsche [[[Telekom]]] detailing plan usage and line item totals.",
  },
  {
    id: 22,
    title: "Deutsche Telekom Invoice — September 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for September 2025.",
    documentDate: "2025-09-15",
    mimeType: "application/pdf",
    snippet:
      "Search match in the September [[[invoice]]] where [[[Telekom]]] service charges are summarized.",
  },
  {
    id: 19,
    title: "Deutsche Telekom Invoice — August 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for August 2025.",
    documentDate: "2025-08-15",
    mimeType: "application/pdf",
    snippet:
      "August [[[invoice]]] from Deutsche [[[Telekom]]] with taxes, plan pricing, and balance details.",
  },
  {
    id: 16,
    title: "Deutsche Telekom Invoice — July 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for July 2025.",
    documentDate: "2025-07-15",
    mimeType: "application/pdf",
    snippet:
      "This [[[invoice]]] contains the July 2025 Deutsche [[[Telekom]]] billing statement and due date.",
  },
  {
    id: 13,
    title: "Deutsche Telekom Invoice — June 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for June 2025.",
    documentDate: "2025-06-15",
    mimeType: "application/pdf",
    snippet:
      "Relevant [[[Telekom]]] [[[invoice]]] context for June 2025, including plan and surcharge details.",
  },
  {
    id: 10,
    title: "Deutsche Telekom Invoice — May 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for May 2025.",
    documentDate: "2025-05-15",
    mimeType: "application/pdf",
    snippet:
      "May [[[invoice]]] from Deutsche [[[Telekom]]] with recurring charges and service notes.",
  },
  {
    id: 7,
    title: "Deutsche Telekom Invoice — April 2025",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for April 2025.",
    documentDate: "2025-04-15",
    mimeType: "application/pdf",
    snippet:
      "Older [[[invoice]]] result from [[[Telekom]]] for April 2025 with a matching search excerpt.",
  },
];

const meta = {
  title: "Pages/SearchPage",
  component: SearchPage,
  parameters: { layout: "fullscreen" },
  args: {
    onSearch: fn(),
    onDocumentClick: fn(),
    onStatusClick: fn(),
  },
} satisfies Meta<typeof SearchPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyState: Story = {
  args: {
    recentDocuments: mockRecentDocuments,
  },
};

export const ActiveSearch: Story = {
  args: {
    query: "invoice telekom",
    searchResults: mockSearchResults,
    totalResults: 12,
  },
};

export const NoResults: Story = {
  args: {
    query: "nonexistent document xyz",
    searchResults: [],
    totalResults: 0,
  },
};
