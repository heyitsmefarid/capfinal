// Shared between Attendance.jsx (the full attendance-management page) and
// Scholars.jsx (a compact, view-only Attendance History section in the
// Scholar View modal) — one source of "which events did this scholar
// attend" row logic so both pages always agree. Moved out of Attendance.jsx
// verbatim; no behavior change.

/**
 * Rows for a scholar's attendance: one per scheduled event in the given
 * term (`term` = null means every term on file, for full history).
 *
 * Orphaned records (matching no current event) are omitted on purpose —
 * they are always left over from a deleted event, never a scan the QR
 * scanner could have produced outside the schedule (it reads this same
 * `events` collection and refuses to scan without a selected event).
 */
export function getScholarAttendanceRows(scholar, events, term) {
  const att = scholar?.attendance || [];
  const termEvents = term
    ? (events || []).filter((e) => e.schoolYear === term.schoolYear && e.semester === term.semester)
    : (events || []);
  return termEvents.map((event) => ({
    key: `evt-${event.firestoreId}`,
    name: event.name,
    date: event.date,
    endTime: event.endTime,
    schoolYear: event.schoolYear,
    semester: event.semester,
    record: att.find((a) => a.activity === event.name) || null,
  }));
}

/** True when an attendance record carries a usable GPS fix (see Pass 4). */
export function hasAttendanceCoords(record) {
  return !!record && typeof record.latitude === 'number' && typeof record.longitude === 'number';
}
