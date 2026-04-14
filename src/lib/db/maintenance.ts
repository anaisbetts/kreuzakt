import { type Kysely, sql } from "kysely";

import { appConfig } from "@/lib/config";
import { getDb } from "@/lib/db/connection";
import type { DB } from "./schema";

declare global {
  var __sqliteMaintenanceRegistered: boolean | undefined;
}

export interface WalCheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

export async function runWalCheckpointTruncate(
  db: Kysely<DB>,
): Promise<WalCheckpointResult | undefined> {
  const result = await sql<WalCheckpointResult>`
    PRAGMA wal_checkpoint(TRUNCATE)
  `.execute(db);

  const row = result.rows[0];
  if (row && row.busy !== 0) {
    console.warn(
      "[sqlite] wal_checkpoint(TRUNCATE) returned busy=1; will retry on next interval",
    );
  }
  return row;
}

export async function runVacuum(db: Kysely<DB>): Promise<void> {
  await sql`VACUUM`.execute(db);
}

let maintenanceIntervalId: ReturnType<typeof setInterval> | undefined;
let vacuumIntervalId: ReturnType<typeof setInterval> | undefined;
let shuttingDown = false;

export function registerSqliteMaintenance(): void {
  if (globalThis.__sqliteMaintenanceRegistered) {
    return;
  }
  globalThis.__sqliteMaintenanceRegistered = true;

  void (async () => {
    try {
      const db = await getDb();

      const intervalMs = appConfig.sqliteMaintenanceIntervalMs;
      if (intervalMs > 0) {
        maintenanceIntervalId = setInterval(() => {
          void runWalCheckpointTruncate(db).catch((err: unknown) => {
            console.error("[sqlite] periodic wal_checkpoint failed:", err);
          });
        }, intervalMs);
      }

      const vacuumMs = appConfig.sqliteVacuumIntervalMs;
      if (vacuumMs > 0) {
        vacuumIntervalId = setInterval(() => {
          void runVacuum(db).catch((err: unknown) => {
            console.error("[sqlite] periodic VACUUM failed:", err);
          });
        }, vacuumMs);
      }

      const shutdown = async () => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;
        if (maintenanceIntervalId !== undefined) {
          clearInterval(maintenanceIntervalId);
          maintenanceIntervalId = undefined;
        }
        if (vacuumIntervalId !== undefined) {
          clearInterval(vacuumIntervalId);
          vacuumIntervalId = undefined;
        }
        try {
          await runWalCheckpointTruncate(db);
        } catch (err: unknown) {
          console.error("[sqlite] shutdown wal_checkpoint failed:", err);
        }
      };

      process.once("SIGTERM", () => void shutdown());
      process.once("SIGINT", () => void shutdown());
    } catch (err: unknown) {
      console.error("[sqlite] failed to register maintenance:", err);
    }
  })();
}
