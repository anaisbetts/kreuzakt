import { Database as BunDatabase } from "bun:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";

import { appConfig } from "@/lib/config";

import { migrateDatabase } from "./migrate";
import type { DB } from "./schema";

let dbInstance: Kysely<DB> | undefined;
let initPromise: Promise<Kysely<DB>> | undefined;

async function createDatabase() {
  await mkdir(path.dirname(appConfig.dbPath), { recursive: true });

  const sqlite = new BunDatabase(appConfig.dbPath, { create: true });

  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;
    PRAGMA cache_size = -64000;
    PRAGMA foreign_keys = ON;
  `);

  const db = new Kysely<DB>({
    dialect: new BunSqliteDialect({
      database: sqlite,
    }),
  });

  await migrateDatabase(db);

  return db;
}

export async function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = createDatabase().then((db) => {
      dbInstance = db;
      return db;
    });
  }

  return initPromise;
}
