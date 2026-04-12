import { describe, expect, it } from "bun:test";
import { access } from "node:fs/promises";
import { getDb } from "../db/connection";
import * as filesModule from "../files";
import { importFromPaperless } from "./orchestrator";
import { PaperlessClient } from "./paperless";

const integrationEnabled =
  process.env.DOCS_AI_RUN_INTEGRATION === "1" ||
  process.env.DOCS_AI_RUN_INTEGRATION === "true";

const paperlessUrl = process.env.PAPERLESS_DEV_URL?.trim();
const paperlessApiKey = process.env.PAPERLESS_DEV_API_KEY?.trim();
const runPaperlessTest = paperlessUrl && paperlessApiKey ? it : it.skip;

describe.skipIf(!integrationEnabled)("Paperless import integration", () => {
  runPaperlessTest(
    "imports a single Paperless document and preserves the added date",
    async () => {
      if (!paperlessUrl || !paperlessApiKey) {
        throw new Error("Paperless integration test requires dev credentials");
      }

      if (!process.env.DATA_DIR?.trim()) {
        throw new Error(
          "Set DATA_DIR to a temporary directory before running this integration test",
        );
      }

      const client = new PaperlessClient({
        baseUrl: paperlessUrl,
        apiKey: paperlessApiKey,
      });
      const documents = await client.listAllDocuments({ maxDocuments: 1 });
      const document = documents[0];

      expect(document).toBeDefined();
      if (!document) {
        throw new Error(
          "No Paperless documents available for integration test",
        );
      }

      const events: unknown[] = [];
      const summary = await importFromPaperless({
        paperlessUrl,
        apiKey: paperlessApiKey,
        maxDocuments: 1,
        onEvent: (event) => {
          events.push(event);
        },
      });

      expect(summary).toEqual({
        total: 1,
        imported: 1,
        duplicates: 0,
        failed: 0,
      });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "started", total: 1 }),
          expect.objectContaining({
            type: "progress",
            current: 1,
            total: 1,
            filename: document.originalFilename,
            status: "completed",
          }),
          expect.objectContaining({
            type: "complete",
            total: 1,
            imported: 1,
            duplicates: 0,
            failed: 0,
          }),
        ]),
      );

      const db = await getDb();
      const queued = await db
        .selectFrom("processing_queue")
        .selectAll()
        .execute();
      const storedDocuments = await db
        .selectFrom("documents")
        .selectAll()
        .execute();

      expect(queued).toHaveLength(1);
      expect(queued[0]?.status).toBe("completed");
      expect(storedDocuments).toHaveLength(1);

      const storedDocument = storedDocuments[0];
      expect(storedDocument).toBeDefined();
      if (!storedDocument) {
        throw new Error("Imported document was not persisted");
      }

      expect(storedDocument.original_filename).toBe(document.originalFilename);
      expect(storedDocument.added_at).toBe(document.addedAt);

      const originalPath = filesModule.getOriginalFilePath(
        storedDocument.stored_filename,
      );
      await access(originalPath);
    },
    120_000,
  );
});
