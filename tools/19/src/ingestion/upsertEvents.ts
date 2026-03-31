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

  // Process in batches of 100 to stay well within parameter limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);

    const rows = await sql<Array<{ is_insert: boolean }>>`
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
      )
      SELECT
        e.external_event_id,
        e.title,
        e.description,
        e.organizer,
        e.start_time,
        e.end_time,
        e.location,
        e.registration_url,
        e.source_feed,
        ${now} AS last_synced_at,
        ${now} AS created_at,
        ${now} AS updated_at
      FROM ${sql(
        batch.map((e) => ({
          external_event_id: e.external_event_id,
          title: e.title,
          description: e.description,
          organizer: e.organizer,
          start_time: e.start_time,
          end_time: e.end_time,
          location: e.location,
          registration_url: e.registration_url,
          source_feed: e.source_feed,
        }))
      )} AS e (
        external_event_id, title, description, organizer,
        start_time, end_time, location, registration_url, source_feed
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

    for (const row of rows) {
      if (row.is_insert) inserted++;
      else updated++;
    }
  }

  return { inserted, updated };
}
