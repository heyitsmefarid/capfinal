// Pure pass/fail helpers for a subject's grade record, shared by
// AcademicRecords.jsx's stats/sorting and its on-hold-notification triggers.
//
// "Passed" is defined by the Remarks field an admin explicitly selects when
// encoding a grade (Passed/Failed/Incomplete/Other) — not guessed from the
// numeric grade value. A blank/unset remarks value is treated as not-failing
// (legacy records only; the encode/edit forms always default remarks to
// 'Passed', so this only matters for pre-existing data missing the field).

export function isFailingSubject(subject) {
  const r = String(subject?.remarks || '').trim().toUpperCase();
  return r !== '' && r !== 'PASSED';
}

// A subject with no numeric grade AND no remarks at all yet — e.g. added on
// the scholar's end before the school has posted a grade. Genuinely
// "not evaluated yet", not a pass, fail, or Incomplete. Kept in its own
// function (rather than folded into isFailingSubject) so callers that need
// to tell "still pending" apart from "actually failing" can — the two used
// to collapse into the same bucket, which is what caused a pending subject
// to silently count as Passed everywhere below.
export function isPendingSubject(subject) {
  const r = String(subject?.remarks || '').trim().toUpperCase();
  return (subject?.grade == null || subject?.grade === '') && r === '';
}

// True if any subject in any of the given term records is failing/incomplete/other.
export function gradesHaveFailure(termRecords) {
  return (termRecords || []).some((entry) => (entry.subjects || []).some(isFailingSubject));
}

// Only counts a subject as Passed once it's actually resolved — excludes
// both failing/incomplete subjects AND pending ones (previously a pending
// subject fell through as "not failing" and was miscounted as Passed).
export function getPassedSubjectsCount(subjects) {
  if (!subjects || subjects.length === 0) return 0;
  return subjects.filter((subject) => !isFailingSubject(subject) && !isPendingSubject(subject)).length;
}

export function getPendingSubjectsCount(subjects) {
  if (!subjects || subjects.length === 0) return 0;
  return subjects.filter(isPendingSubject).length;
}

// Explicit count rather than "total - passed" subtraction, so a pending
// subject (excluded from getPassedSubjectsCount) doesn't silently inflate
// this bucket either — it's excluded from both, and shown separately.
// (isFailingSubject already returns false for a blank-remarks pending
// subject, so this needs no separate pending check — kept as its own named
// function so call sites read intent, not just a raw filter.)
export function getFailedOrIncCount(subjects) {
  if (!subjects || subjects.length === 0) return 0;
  return subjects.filter(isFailingSubject).length;
}

// Units-weighted average grade. Shared by AcademicRecords.jsx and
// Scholars.jsx's Records view so both compute the exact same number — moved
// here (was previously duplicated only in AcademicRecords.jsx) rather than
// re-implemented a second time. A subject with no numeric grade (pending —
// see isPendingSubject) correctly falls out of both sums via Number.isFinite,
// so pending subjects never skew the average.
export function computeGwa(subjects) {
  if (!subjects || subjects.length === 0) return null;
  let totalUnits = 0;
  let weightedSum = 0;
  for (const s of subjects) {
    const grade = typeof s.grade === 'number' ? s.grade : Number.parseFloat(s.grade);
    const units = typeof s.units === 'number' ? s.units : Number.parseFloat(s.units);
    if (Number.isFinite(grade) && Number.isFinite(units) && units > 0) {
      weightedSum += grade * units;
      totalUnits += units;
    }
  }
  return totalUnits > 0 ? (weightedSum / totalUnits).toFixed(2) : null;
}
