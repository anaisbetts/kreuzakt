import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { runVacuum, runWalCheckpointTruncate } from "./maintenance";
import type { DB } from "./schema";

describe("runWalCheckpointTruncate", () => {
  it("runs PRAGMA wal_checkpoint(TRUNCATE) without error", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-maint-"));
    const dbPath = path.join(dir, "t.db");
    try {
      const sqlite = new Database(dbPath, { create: true });
      sqlite.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
      `);
      const db = new Kysely<DB>({
        dialect: new BunSqliteDialect({ database: sqlite }),
      });

      const row = await runWalCheckpointTruncate(db);
      expect(row).toBeDefined();
      expect(row?.busy).toBe(0);

      sqlite.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("runVacuum", () => {
  it("runs VACUUM without error", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-vac-"));
    const dbPath = path.join(dir, "t.db");
    try {
      const sqlite = new Database(dbPath, { create: true });
      sqlite.exec("PRAGMA journal_mode = WAL;");
      const db = new Kysely<DB>({
        dialect: new BunSqliteDialect({ database: sqlite }),
      });

      await expect(runVacuum(db)).resolves.toBeUndefined();

      sqlite.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
