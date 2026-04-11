import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { DocumentViewerPage } from "./DocumentViewerPage";

const extractedText = `Deutsche Telekom

Rechnung

Kundennummer              12345678
Rechnungsnummer           556 200 382 7
Rechnungsdatum            15.03.2026
Abrechnungszeitraum       01.03.2026 - 31.03.2026

Sehr geehrte Kundin, sehr geehrter Kunde,

anbei erhalten Sie Ihre Rechnung für den oben genannten
Abrechnungszeitraum.

Ihre Rechnungsübersicht

Mobilfunk
  Festpreis MagentaMobil L                     49,95 EUR
  Zubuchoption StreamOn Music & Video            9,95 EUR
  Summe Mobilfunk                               59,90 EUR

Rechnungsbetrag netto                           50,34 EUR
Umsatzsteuer 19%                                 9,56 EUR

Gesamtbetrag                                    59,90 EUR

Der Rechnungsbetrag wird am 01.04.2026 von Ihrem Konto
IBAN DE89 3704 0044 0532 0130 00 abgebucht.

Vielen Dank, dass Sie sich für die Telekom entschieden haben.

Telekom Deutschland GmbH
Landgrabenweg 151
53227 Bonn`;

const meta = {
  title: "Pages/DocumentViewerPage",
  component: DocumentViewerPage,
  parameters: { layout: "fullscreen" },
  args: {
    onBack: fn(),
    onDownload: fn(),
    onToggleText: fn(),
    onPageChange: fn(),
    onStatusClick: fn(),
  },
} satisfies Meta<typeof DocumentViewerPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PDFDocument: Story = {
  args: {
    id: 42,
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    addedAt: "2026-03-20T14:30:00Z",
    originalFilename: "scan_20260315.pdf",
    mimeType: "application/pdf",
    fileSize: 245760,
    pageCount: 2,
    content: extractedText,
  },
};

export const ImageDocument: Story = {
  args: {
    id: 40,
    title: "Kitchen Renovation Receipt",
    description:
      "Receipt from Bauhaus for kitchen counter materials and installation.",
    documentDate: "2026-02-20",
    addedAt: "2026-02-21T09:15:00Z",
    originalFilename: "IMG_20260220_receipt.jpg",
    mimeType: "image/jpeg",
    fileSize: 1843200,
    content:
      "BAUHAUS\nFachcentren GmbH & Co. KG\nFiliale Berlin-Tempelhof\nGermaniastr. 36, 12099 Berlin\n\nKASSENBON\n\n20.02.2026   14:23    Kasse 07\n\nGranitplatte Küche 240x60cm\n  Art.-Nr. 294.837.221         890,00\nMontageservice pauschal\n  Art.-Nr. 900.100.003         350,00\nSilikon Sanitär transp. 310ml\n  Art.-Nr. 112.449.008     2x   1,75\n                               -----\nSumme                       1.243,50 EUR\nMwSt 19%                      198,66 EUR\n\nEC-Kartenzahlung             1.243,50 EUR\nKartennr. ****4821\n\nVielen Dank für Ihren Einkauf!",
  },
};

export const MultiPagePDF: Story = {
  args: {
    id: 41,
    title: "Apartment Lease Agreement",
    description:
      "Rental contract for the apartment at Berliner Str. 42, signed December 2024.",
    documentDate: "2024-12-01",
    addedAt: "2024-12-05T10:00:00Z",
    originalFilename: "mietvertrag_berliner_str_42.pdf",
    mimeType: "application/pdf",
    fileSize: 524288,
    pageCount: 5,
    currentPage: 3,
    content: extractedText,
  },
};

export const ExtractedText: Story = {
  args: {
    id: 42,
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    addedAt: "2026-03-20T14:30:00Z",
    originalFilename: "scan_20260315.pdf",
    mimeType: "application/pdf",
    fileSize: 245760,
    pageCount: 2,
    content: extractedText,
    showExtractedText: true,
  },
};
