import { writeFile } from "node:fs/promises";

import { getDb } from "@/lib/db/connection";
import {
  buildStoredFilename,
  computeBufferHash,
  ensureAppDirectories,
  findDuplicateDocumentId,
  getOriginalFilePath,
  getThumbnailPath,
} from "@/lib/files";

type SeedDocument = {
  title: string;
  description: string;
  documentDate: string;
  addedAt: string;
  originalFilename: string;
  mimeType: string;
  pageCount?: number;
  content: string;
  fileBuffer: Buffer;
};

const THUMBNAIL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEBUQEBAVFRUVFRUVFRUVFRUVFRUVFRUWFhUVFRUYHSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0mICYtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAAAAQID/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEAMQAAAB6A//xAAVEAEBAAAAAAAAAAAAAAAAAAAAEf/aAAgBAQABBQJf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=",
  "base64",
);

const PNG_IMAGE = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9s4mN1YAAAAASUVORK5CYII=",
  "base64",
);

const JPEG_IMAGE = THUMBNAIL_JPEG;

function escapePdfText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function createPdfBuffer(lines: string[]) {
  const stream = [
    "BT",
    "/F1 12 Tf",
    "72 760 Td",
    ...lines.flatMap((line, index) =>
      index === 0
        ? [`(${escapePdfText(line)}) Tj`]
        : ["0 -18 Td", `(${escapePdfText(line)}) Tj`],
    ),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

const extractedTelekomText = `Deutsche Telekom

Rechnung

Kundennummer 12345678
Rechnungsdatum 15.03.2026
Abrechnungszeitraum 01.03.2026 - 31.03.2026

Mobilfunk
Festpreis MagentaMobil L 49,95 EUR
Zubuchoption StreamOn Music & Video 9,95 EUR
Gesamtbetrag 59,90 EUR`;

const seedDocuments: SeedDocument[] = [
  {
    title: "Deutsche Telekom Invoice — March 2026",
    description:
      "Monthly mobile service invoice from Deutsche Telekom for the billing period March 2026.",
    documentDate: "2026-03-15",
    addedAt: "2026-03-20T14:30:00Z",
    originalFilename: "scan_20260315.pdf",
    mimeType: "application/pdf",
    pageCount: 2,
    content: extractedTelekomText,
    fileBuffer: createPdfBuffer([
      "Deutsche Telekom Invoice",
      "Billing period: March 2026",
      "Amount due: 59.90 EUR",
    ]),
  },
  {
    title: "Apartment Lease Agreement",
    description:
      "Rental contract for the apartment at Berliner Str. 42, signed December 2024.",
    documentDate: "2024-12-01",
    addedAt: "2024-12-05T10:00:00Z",
    originalFilename: "mietvertrag_berliner_str_42.pdf",
    mimeType: "application/pdf",
    pageCount: 5,
    content: `Apartment Lease Agreement

Tenant: Anais Betts
Address: Berliner Str. 42
Term begins: 2024-12-01
Monthly rent: 1,450 EUR`,
    fileBuffer: createPdfBuffer([
      "Apartment Lease Agreement",
      "Address: Berliner Str. 42",
      "Monthly rent: 1450 EUR",
    ]),
  },
  {
    title: "Kitchen Renovation Receipt",
    description:
      "Receipt from Bauhaus for kitchen counter materials and installation.",
    documentDate: "2026-02-20",
    addedAt: "2026-02-21T09:15:00Z",
    originalFilename: "IMG_20260220_receipt.jpg",
    mimeType: "image/jpeg",
    content: `BAUHAUS
Kitchen counter materials
Installation service
Total: 1243.50 EUR`,
    fileBuffer: JPEG_IMAGE,
  },
  {
    title: "Health Insurance Card — 2026",
    description:
      "Scanned copy of the AOK health insurance card, valid through December 2026.",
    documentDate: "2026-01-01",
    addedAt: "2026-01-05T08:00:00Z",
    originalFilename: "aok_card_2026.png",
    mimeType: "image/png",
    content: `AOK Health Insurance Card
Valid through December 2026
Policy holder: Anais Betts`,
    fileBuffer: PNG_IMAGE,
  },
  {
    title: "Car Insurance Policy Renewal",
    description:
      "HUK-COBURG auto insurance renewal notice for the policy period 2026–2027.",
    documentDate: "2025-11-30",
    addedAt: "2025-12-01T12:00:00Z",
    originalFilename: "huk_coburg_renewal_2026.pdf",
    mimeType: "application/pdf",
    pageCount: 3,
    content: `HUK-COBURG Auto Insurance
Renewal notice
Policy period: 2026-2027
Premium due: 843.20 EUR`,
    fileBuffer: createPdfBuffer([
      "HUK-COBURG Auto Insurance",
      "Renewal notice for 2026-2027",
      "Premium due: 843.20 EUR",
    ]),
  },
  {
    title: "Employment Contract Addendum",
    description:
      "Addendum covering a compensation adjustment and updated remote-work terms.",
    documentDate: "2025-08-01",
    addedAt: "2025-08-02T10:30:00Z",
    originalFilename: "employment_addendum.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    content: `Employment Contract Addendum

Effective date: 2025-08-01
Compensation adjustment approved
Remote work policy updated to three days per week`,
    fileBuffer: Buffer.from(
      "Employment Contract Addendum\nEffective date: 2025-08-01\nCompensation adjustment approved.\n",
      "utf8",
    ),
  },
];

async function seed() {
  await ensureAppDirectories();

  const db = await getDb();
  let inserted = 0;
  let skipped = 0;

  for (const document of seedDocuments) {
    const fileHash = computeBufferHash(document.fileBuffer);
    const duplicateId = await findDuplicateDocumentId(fileHash);

    if (duplicateId) {
      const existing = await db
        .selectFrom("documents")
        .select("id")
        .where("file_hash", "=", fileHash)
        .executeTakeFirstOrThrow();

      await writeFile(getThumbnailPath(existing.id), THUMBNAIL_JPEG);
      skipped += 1;
      continue;
    }

    const storedFilename = buildStoredFilename(
      fileHash,
      document.originalFilename,
    );

    await writeFile(getOriginalFilePath(storedFilename), document.fileBuffer);

    await db
      .insertInto("documents")
      .values({
        original_filename: document.originalFilename,
        stored_filename: storedFilename,
        mime_type: document.mimeType,
        file_hash: fileHash,
        file_size: document.fileBuffer.byteLength,
        page_count: document.pageCount ?? null,
        title: document.title,
        description: document.description,
        document_date: document.documentDate,
        content: document.content,
        added_at: document.addedAt,
      })
      .execute();

    const insertedDocument = await db
      .selectFrom("documents")
      .select("id")
      .where("file_hash", "=", fileHash)
      .executeTakeFirstOrThrow();

    await writeFile(getThumbnailPath(insertedDocument.id), THUMBNAIL_JPEG);

    inserted += 1;
  }

  console.log(`Seed complete: inserted ${inserted}, skipped ${skipped}`);
}

await seed();
