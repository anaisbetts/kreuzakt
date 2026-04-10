import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SearchPage } from './SearchPage';

const mockRecentDocuments = [
  {
    id: 42,
    title: 'Deutsche Telekom Invoice — March 2026',
    description:
      'Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.',
    documentDate: '2026-03-15',
    mimeType: 'application/pdf',
  },
  {
    id: 41,
    title: 'Apartment Lease Agreement',
    description:
      'Rental contract for the apartment at Berliner Str. 42, signed December 2024.',
    documentDate: '2024-12-01',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 40,
    title: 'Kitchen Renovation Receipt',
    description: 'Receipt from Bauhaus for kitchen counter materials and installation.',
    documentDate: '2026-02-20',
    mimeType: 'image/jpeg',
  },
  {
    id: 39,
    title: 'Health Insurance Card — 2026',
    description:
      'Scanned copy of the AOK health insurance card, valid through December 2026.',
    documentDate: '2026-01-01',
    mimeType: 'image/png',
  },
  {
    id: 38,
    title: 'Deutsche Telekom Invoice — February 2026',
    description:
      'Monthly mobile service invoice from Deutsche Telekom for the billing period February 2026.',
    documentDate: '2026-02-15',
    mimeType: 'application/pdf',
  },
  {
    id: 37,
    title: 'Car Insurance Policy Renewal',
    description:
      'HUK-COBURG auto insurance renewal notice for the policy period 2026–2027.',
    documentDate: '2025-11-30',
    mimeType: 'application/pdf',
  },
];

const mockSearchResults = [
  {
    id: 42,
    title: 'Deutsche Telekom Invoice — March 2026',
    documentDate: '2026-03-15',
    mimeType: 'application/pdf',
    snippet:
      '...monthly invoice for mobile service from Telekom for the billing period ending March 2026. Total amount: EUR 59.90...',
  },
  {
    id: 38,
    title: 'Deutsche Telekom Invoice — February 2026',
    documentDate: '2026-02-15',
    mimeType: 'application/pdf',
    snippet:
      '...your Telekom mobile plan invoice for February. MagentaMobil L, data add-on 10 GB. Total: EUR 59.90...',
  },
  {
    id: 35,
    title: 'Deutsche Telekom Invoice — January 2026',
    documentDate: '2026-01-15',
    mimeType: 'application/pdf',
    snippet:
      '...Telekom invoice for the billing period January 2026. Customer number: 12345678. Amount due: EUR 49.95...',
  },
];

const meta = {
  title: 'Pages/SearchPage',
  component: SearchPage,
  parameters: { layout: 'fullscreen' },
  args: {
    onSearch: fn(),
    onDocumentClick: fn(),
    onPageChange: fn(),
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
    query: 'invoice telekom',
    searchResults: mockSearchResults,
    totalResults: 12,
    currentPage: 1,
    totalPages: 3,
  },
};

export const NoResults: Story = {
  args: {
    query: 'nonexistent document xyz',
    searchResults: [],
    totalResults: 0,
    currentPage: 1,
    totalPages: 1,
  },
};
