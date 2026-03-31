import ical from "node-ical";
import type { ParsedEvent } from "../db/schema.js";

/**
 * Parses raw ICS text into an array of ParsedEvent records.
 *
 * Field mapping:
 *   UID         -> external_event_id
 *   SUMMARY     -> title
 *   DESCRIPTION -> description
 *   DTSTART     -> start_time
 *   DTEND       -> end_time
 *   LOCATION    -> location
 *   URL         -> registration_url
 *   ORGANIZER   -> organizer (CN name extracted when present)
 *
 * Events without a UID or DTSTART are skipped — they cannot be
 * reliably upserted or displayed.
 */
export function parseIcsFeed(
  icsText: string,
  sourceFeed: string
): ParsedEvent[] {
  const data = ical.sync.parseICS(icsText);
  const events: ParsedEvent[] = [];

  for (const key of Object.keys(data)) {
    const component = data[key];
    if (component.type !== "VEVENT") continue;

    const uid = component.uid;
    if (!uid) continue;

    const startTime = component.start;
    if (!startTime) continue;

    const title =
      typeof component.summary === "string" && component.summary.trim()
        ? component.summary.trim()
        : "(no title)";

    const description =
      typeof component.description === "string" && component.description.trim()
        ? component.description.trim()
        : null;

    const endTime =
      component.end instanceof Date ? component.end : null;

    const location =
      typeof component.location === "string" && component.location.trim()
        ? component.location.trim()
        : null;

    // URL field maps directly to registration_url
    const registrationUrl =
      typeof component.url === "string" && component.url.trim()
        ? component.url.trim()
        : null;

    const organizer = extractOrganizer(component.organizer);

    events.push({
      external_event_id: uid,
      title,
      description,
      organizer,
      start_time: startTime,
      end_time: endTime,
      location,
      registration_url: registrationUrl,
      source_feed: sourceFeed,
    });
  }

  return events;
}

/**
 * Extracts a human-readable organizer name from the raw ICS ORGANIZER field.
 *
 * ICS ORGANIZER can arrive in several shapes from node-ical:
 *   - a plain string: "CN=Jane Doe:mailto:jane@example.com"
 *   - an object:      { params: { CN: "Jane Doe" }, val: "mailto:jane@example.com" }
 *
 * We prefer the CN (common name). If absent, we return null rather than
 * exposing a raw mailto URI.
 */
function extractOrganizer(raw: unknown): string | null {
  if (!raw) return null;

  // Object shape from node-ical
  if (typeof raw === "object" && raw !== null) {
    const params = (raw as Record<string, unknown>).params;
    if (params && typeof (params as Record<string, unknown>).CN === "string") {
      return ((params as Record<string, unknown>).CN as string).trim() || null;
    }
    return null;
  }

  // String shape: "CN=Jane Doe:mailto:jane@example.com"
  if (typeof raw === "string") {
    const cnMatch = raw.match(/CN=([^;:]+)/);
    if (cnMatch) return cnMatch[1].trim() || null;
    return null;
  }

  return null;
}
