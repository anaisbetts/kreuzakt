import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { SearchResultCard } from './SearchResultCard';

const meta = {
  title: 'Components/SearchResultCard',
  component: SearchResultCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onClick: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchResultCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 42,
    title: 'Deutsche Telekom Invoice — March 2026',
    documentDate: '2026-03-15',
    mimeType: 'application/pdf',
    snippet:
      '...monthly invoice for mobile service from Telekom for the billing period ending March 2026...',
  },
};

export const ImageResult: Story = {
  args: {
    id: 5,
    title: 'Kitchen renovation receipt',
    documentDate: '2026-02-20',
    mimeType: 'image/jpeg',
    snippet:
      '...receipt from Bauhaus, total EUR 1,243.50 for counter materials and installation...',
  },
};
