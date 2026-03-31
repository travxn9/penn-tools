import type postgres from "postgres";
import type { ParsedEvent } from "../db/schema.js";

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/**
 * Upserts an array of ParsedEvents into the events table.
 *
 * Uses `external_event_id` as the conflict target so re-running
 * ingestion updates existing rows without creating duplicates.
 *
 * Returns the count of rows inserted vs updated.
 *
 * @param sql  - A `postgres` client (from the `postgres` npm package).
 * @param events - Parsed events to upsert.
 */
export async function upsertEvents(
  sql: postgres.Sql,
  events: ParsedEvent[]
): Promise<UpsertResult> {
  if (events.length === 0) return { inserted: 0, updated: 0 };

  let inserted = 0;
  let updated = 0;
  const now = new Date();

  // Upsert one row at a time — simple and reliable with the postgres package
  for (const event of events) {
    const result = await sql<Array<{ is_insert: boolean }>>`
      INSERT INTO events (
        external_event_id,
        title,
        description,
        organizer,
        start_time,
        end_time,
        location,
        registration_url,
        source_feed,
        last_synced_at,
        created_at,
        updated_at
      ) VALUES (
        ${event.external_event_id},
        ${event.title},
        ${event.description},
        ${event.organizer},
        ${event.start_time},
        ${event.end_time},
        ${event.location},
        ${event.registration_url},
        ${event.source_feed},
        ${now},
        ${now},
        ${now}
      )
      ON CONFLICT (external_event_id) DO UPDATE SET
        title            = EXCLUDED.title,
        description      = EXCLUDED.description,
        organizer        = EXCLUDED.organizer,
        start_time       = EXCLUDED.start_time,
        end_time         = EXCLUDED.end_time,
        location         = EXCLUDED.location,
        registration_url = EXCLUDED.registration_url,
        source_feed      = EXCLUDED.source_feed,
        last_synced_at   = EXCLUDED.last_synced_at,
        updated_at       = EXCLUDED.updated_at
      RETURNING (xmax = 0) AS is_insert
    `;

    if (result[0]?.is_insert) inserted++;
    else updated++;
  }

  return { inserted, updated };
}
