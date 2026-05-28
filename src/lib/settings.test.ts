import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";

import { migrateDatabase } from "@/lib/db/migrate";
import type { DB } from "@/lib/db/schema";
import { getPreferredLanguage, setPreferredLanguage } from "@/lib/settings";

async function createTestDb() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "kreuzakt-settings-"));
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

describe("getPreferredLanguage", () => {
  it("returns null when unset", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await expect(getPreferredLanguage(db)).resolves.toBeNull();
    } finally {
      await cleanup();
    }
  });

  it("returns trimmed value when set", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await setPreferredLanguage("  German  ", db);
      await expect(getPreferredLanguage(db)).resolves.toBe("German");
    } finally {
      await cleanup();
    }
  });
});

describe("setPreferredLanguage", () => {
  it("upserts and replaces the stored value", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await expect(setPreferredLanguage("English", db)).resolves.toBe(
        "English",
      );
      await expect(getPreferredLanguage(db)).resolves.toBe("English");

      await expect(setPreferredLanguage("French", db)).resolves.toBe("French");
      await expect(getPreferredLanguage(db)).resolves.toBe("French");
    } finally {
      await cleanup();
    }
  });

  it("clears the setting when given blank input", async () => {
    const { db, cleanup } = await createTestDb();
    try {
      await setPreferredLanguage("German", db);
      await expect(setPreferredLanguage("   ", db)).resolves.toBeNull();
      await expect(getPreferredLanguage(db)).resolves.toBeNull();
    } finally {
      await cleanup();
    }
  });
});
