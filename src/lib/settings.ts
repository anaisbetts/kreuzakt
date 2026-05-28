import type { Kysely } from "kysely";

import { getDb } from "@/lib/db/connection";
import type { DB } from "@/lib/db/schema";

export const PREFERRED_LANGUAGE_KEY = "preferred_language";

export async function getPreferredLanguage(
  db?: Kysely<DB>,
): Promise<string | null> {
  const database = db ?? (await getDb());
  const row = await database
    .selectFrom("app_settings")
    .select("value")
    .where("key", "=", PREFERRED_LANGUAGE_KEY)
    .executeTakeFirst();

  const trimmed = row?.value.trim();
  return trimmed ? trimmed : null;
}

export async function setPreferredLanguage(
  value: string,
  db?: Kysely<DB>,
): Promise<string | null> {
  const trimmed = value.trim();
  const database = db ?? (await getDb());

  if (!trimmed) {
    await database
      .deleteFrom("app_settings")
      .where("key", "=", PREFERRED_LANGUAGE_KEY)
      .execute();
    return null;
  }

  await database
    .insertInto("app_settings")
    .values({ key: PREFERRED_LANGUAGE_KEY, value: trimmed })
    .onConflict((oc) => oc.column("key").doUpdateSet({ value: trimmed }))
    .execute();

  return trimmed;
}
