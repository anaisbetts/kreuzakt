import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";

import { migrateDatabase } from "@/lib/db/migrate";
import type { DB } from "@/lib/db/schema";
import {
  buildDocumentTextExport,
  ExportEmptyError,
  formatExportTextContent,
  formatExportZipFilename,
  sanitizeExportBasename,
} from "@/lib/exportText";

async function createTestDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-export-text-"));
  const dbPath = path.join(dir, "t.db");
  const sqlite = new Database(dbPath, { create: true });
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
  `);
  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({ database: sqlite }),
  });

  await migrateDatabase(db);

  return {
    db,
    cleanup: async () => {
      sqlite.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}

async function insertDocument(
  db: Kysely<DB>,
  values: {
    title: string;
    original_filename: string;
    content: string;
  },
) {
  const suffix = crypto.randomUUID();

  return db
    .insertInto("documents")
    .values({
      original_filename: values.original_filename,
      stored_filename: `${suffix}.bin`,
      mime_type: "text/plain",
      file_hash: suffix,
      file_size: values.content.length,
      title: values.title,
      description: "",
      content: values.content,
      added_at: new Date().toISOString(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}

function decodeZipEntry(data: Uint8Array) {
  return new TextDecoder().decode(data);
}

function splitExportText(text: string) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);

  if (!match) {
    throw new Error("expected YAML frontmatter block");
  }

  const [, frontmatter, body] = match;
  if (!frontmatter || body === undefined) {
    throw new Error("expected YAML frontmatter block");
  }

  return { frontmatter, body };
}

describe("formatExportTextContent", () => {
  it("includes frontmatter fields and content after the closing delimiter", () => {
    const formatted = formatExportTextContent({
      id: 42,
      title: "Annual Report",
      original_filename: "scan_20260315.pdf",
      content: "Actual document content here...",
    });

    const { frontmatter, body } = splitExportText(formatted);

    expect(frontmatter).toContain("original_filename: scan_20260315.pdf");
    expect(frontmatter).toContain("document_url: /documents/42");
    expect(frontmatter).toContain("original_url: /api/documents/42/original");
    expect(body).toBe("Actual document content here...");
  });

  it("uses absolute URLs when baseUrl is provided", () => {
    const formatted = formatExportTextContent(
      {
        id: 7,
        title: "Memo",
        original_filename: "memo.pdf",
        content: "body",
      },
      "https://docs.example.ts.net",
    );

    const { frontmatter } = splitExportText(formatted);

    expect(frontmatter).toContain(
      'document_url: "https://docs.example.ts.net/documents/7"',
    );
    expect(frontmatter).toContain(
      'original_url: "https://docs.example.ts.net/api/documents/7/original"',
    );
  });

  it("quotes original filenames with YAML-special characters", () => {
    const formatted = formatExportTextContent({
      id: 3,
      title: "Scan",
      original_filename: "scan:2026#1.pdf",
      content: "text",
    });

    const { frontmatter } = splitExportText(formatted);

    expect(frontmatter).toContain('original_filename: "scan:2026#1.pdf"');
  });
});

describe("sanitizeExportBasename", () => {
  it("builds id-prefixed filenames from titles", () => {
    expect(sanitizeExportBasename(42, "Annual Report", "report.pdf")).toBe(
      "42-Annual Report.txt",
    );
  });

  it("sanitizes unsafe filename characters", () => {
    expect(
      sanitizeExportBasename(7, "Bad: name/with\\chars*?", "ignored.pdf"),
    ).toBe("7-Bad_ name_with_chars__.txt");
  });

  it("falls back to original filename without extension when title is blank", () => {
    expect(sanitizeExportBasename(3, "   ", "Quarterly Summary.pdf")).toBe(
      "3-Quarterly Summary.txt",
    );
  });

  it("caps the basename near 100 characters", () => {
    const longTitle = "x".repeat(120);
    const basename = sanitizeExportBasename(99, longTitle, "fallback.pdf");

    expect(basename.endsWith(".txt")).toBe(true);
    expect(basename.length).toBeLessThanOrEqual(100);
    expect(basename.startsWith("99-")).toBe(true);
  });
});

describe("formatExportZipFilename", () => {
  it("uses the kreuzakt export naming pattern", () => {
    const filename = formatExportZipFilename(
      new Date("2026-05-29T14:05:09.000Z"),
    );

    expect(filename).toMatch(/^kreuzakt-text-export-\d{8}-\d{6}\.zip$/);
  });
});

describe("buildDocumentTextExport", () => {
  it("throws when no documents have exportable text", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await insertDocument(db, {
        title: "Empty",
        original_filename: "empty.txt",
        content: "   \n\t  ",
      });

      await expect(buildDocumentTextExport(db)).rejects.toBeInstanceOf(
        ExportEmptyError,
      );
    } finally {
      await cleanup();
    }
  });

  it("exports non-empty documents in ascending id order", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      const first = await insertDocument(db, {
        title: "First",
        original_filename: "first.txt",
        content: "first body",
      });
      const second = await insertDocument(db, {
        title: "Second",
        original_filename: "second.txt",
        content: "second body",
      });
      await insertDocument(db, {
        title: "Skipped",
        original_filename: "skipped.txt",
        content: " ",
      });

      const result = await buildDocumentTextExport(db);
      const entries = unzipSync(result.zipBuffer);
      const names = Object.keys(entries);

      expect(result.documentCount).toBe(2);
      expect(names).toEqual([
        sanitizeExportBasename(first.id, "First", "first.txt"),
        sanitizeExportBasename(second.id, "Second", "second.txt"),
      ]);
      const [firstName, secondName] = names;
      expect(firstName).toBeDefined();
      expect(secondName).toBeDefined();
      if (!firstName || !secondName) {
        throw new Error("expected two zip entries");
      }

      const firstEntry = splitExportText(decodeZipEntry(entries[firstName]));
      const secondEntry = splitExportText(decodeZipEntry(entries[secondName]));

      expect(firstEntry.frontmatter).toContain("original_filename: first.txt");
      expect(firstEntry.frontmatter).toContain(
        `document_url: /documents/${first.id}`,
      );
      expect(firstEntry.frontmatter).toContain(
        `original_url: /api/documents/${first.id}/original`,
      );
      expect(firstEntry.body).toBe("first body");

      expect(secondEntry.frontmatter).toContain(
        "original_filename: second.txt",
      );
      expect(secondEntry.body).toBe("second body");
    } finally {
      await cleanup();
    }
  });
});
