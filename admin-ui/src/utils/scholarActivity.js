// Identifies long-inactive graduated scholars for admin review (never an
// automatic status change — this file is pure read/derive logic).
//
// "Activity" here means a real, existing timestamp already on record —
// never invented. `lastLogin` exists in the data model (and is even
// displayed in UserManagement.jsx) but no code path anywhere actually
// writes it, so it's deliberately not used as a signal.

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// A scholar's last known activity: the latest of their graduation/archive
// date, any COR/COG submission timestamp, and any message THEY sent (not
// admin-sent — messages.fromUserId === scholar.firestoreId). Returns null
// when none of these are on record, so callers can render "no record on
// file" instead of guessing.
export function computeLastActivity(scholar, messages = []) {
  const candidates = [
    toDate(scholar?.archivedDate),
    ...(Array.isArray(scholar?.cogSubmissions) ? scholar.cogSubmissions.map((c) => toDate(c?.uploadedAt)) : []),
    ...(Array.isArray(scholar?.corSubmissions) ? scholar.corSubmissions.map((c) => toDate(c?.uploadedAt)) : []),
    ...(Array.isArray(messages) && scholar?.firestoreId
      ? messages
          .filter((m) => m?.fromUserId === scholar.firestoreId)
          .map((m) => toDate(m?.createdAt))
      : []),
  ].filter(Boolean);

  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates.map((d) => d.getTime())));
}

// Whether a graduated scholar has had no known activity for longer than
// thresholdDays. A scholar with no real activity signal at all (e.g.
// graduated but not yet archived, no submissions, no messages) is never
// flagged — there's nothing real to judge inactivity against.
export function isInactiveGraduate(scholar, messages, thresholdDays) {
  const last = computeLastActivity(scholar, messages);
  if (!last) return false;
  if (!(thresholdDays > 0)) return false;
  const days = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  return days > thresholdDays;
}
