// Parses the wide migration sheet's semester blocks into the shapes the app
// already reads (`grades[]` / `enrolledSemesters[]`). Pure functions with
// explicit params, matching the utils/granting.js convention, so the whole
// import can be unit-tested without Firestore or a browser.

import { computeGwa } from './academicRecords.js';

export const VALID_REMARKS = ['Passed', 'Failed'];

// Blocks are discovered from the header rather than hardcoded, so an admin who
// hand-adds an 8th semester block to the template imports it correctly.
export function discoverSemesterBlocks(headerKeys) {
  const numbers = new Set();
  for (const key of headerKeys || []) {
    const match = /^SY(\d+)\s+School Year$/.exec(String(key).trim());
    if (match) numbers.add(Number(match[1]));
  }
  return [...numbers]
    .sort((a, b) => a - b)
    .map((n) => ({
      prefix: `SY${n}`,
      yearKey: `SY${n} School Year`,
      semesterKey: `SY${n} Semester`,
      subjectsKey: `SY${n} Subjects`,
      amountKey: `SY${n} Amount Granted`,
      statusKey: `SY${n} Status`,
    }));
}

// One term's subjects, packed into a single cell as
// `Code|Name|Units|Grade|Remarks; Code|Name|Units|Grade|Remarks`. Grade and
// Remarks are optional (3-5 fields) — a subject with no grade is "pending" and
// correctly falls out of computeGwa. The code may be blank, but its slot must
// be there: without it `Math|3|1.75|Passed` would silently read as a subject
// named "3" with code "Math".
export function parseSubjectCell(cell) {
  const raw = String(cell ?? '').trim();
  if (!raw) return { subjects: [], errors: [] };

  const subjects = [];
  const errors = [];

  raw.split(';').map((e) => e.trim()).filter(Boolean).forEach((entry, i) => {
    const label = `entry ${i + 1}`;
    const parts = entry.split('|').map((p) => p.trim());

    if (parts.length < 3 || parts.length > 5) {
      errors.push(`${label} — expected Code|Name|Units|Grade|Remarks (3-5 fields), got ${parts.length}`);
      return;
    }

    const [code, name, unitsRaw, gradeRaw = '', remarksRaw = ''] = parts;
    if (!name) {
      errors.push(`${label} — missing subject name`);
      return;
    }
    if (/^\d+(\.\d+)?$/.test(name)) {
      errors.push(`${label} — subject name reads as the number "${name}": the course code goes first, as Code|Name|Units|Grade|Remarks`);
      return;
    }

    const units = Number(unitsRaw);
    if (!Number.isFinite(units) || units <= 0) {
      errors.push(`${label} (${name}) — Units must be a number greater than 0`);
      return;
    }

    let grade = null;
    if (gradeRaw !== '') {
      grade = Number(gradeRaw);
      if (!Number.isFinite(grade)) {
        errors.push(`${label} (${name}) — Grade must be a number`);
        return;
      }
    }

    // A gradeless subject (the two-field form) is pending, not Passed — only
    // an explicit grade earns the 'Passed' default. isPendingSubject() in
    // academicRecords.js requires remarks === '', so defaulting a gradeless
    // subject to 'Passed' here would silently count it as Passed there.
    const remarks = remarksRaw || (grade === null ? '' : 'Passed');
    if (remarks !== '' && !VALID_REMARKS.includes(remarks)) {
      errors.push(`${label} (${name}) — Remarks must be one of ${VALID_REMARKS.join(', ')}`);
      return;
    }

    subjects.push({ code, name, units, grade, remarks });
  });

  const seen = new Set();
  for (const subject of subjects) {
    const key = subject.name.toLowerCase();
    if (seen.has(key)) errors.push(`duplicate subject "${subject.name}" in the same term`);
    seen.add(key);
  }

  return { subjects, errors };
}

// A synthetic enrollment timestamp derived from the term itself. getGrantBreakdown
// sorts enrolledSemesters by `enrolledAt`, so migrated terms need one that orders
// correctly: 1st Semester starts in August of the school year's first year, 2nd
// Semester in January of its second.
export function termEnrolledAt(schoolYear, semester) {
  const startYear = Number(String(schoolYear).split('-')[0]);
  const isSecond = String(semester).trim() === '2nd Semester';
  const year = isSecond ? startYear + 1 : startYear;
  const month = isSecond ? 0 : 7;
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

// Turns one wide sheet row into the arrays the app already renders. Terms come
// back in chronological order regardless of the order the blocks were filled in.
export function assembleScholarHistory(row, blocks) {
  const grades = [];
  const enrolledSemesters = [];
  const errors = [];

  for (const block of blocks) {
    const schoolYear = String(row[block.yearKey] ?? '').trim();
    const semester = String(row[block.semesterKey] ?? '').trim();
    const subjectsCell = String(row[block.subjectsKey] ?? '').trim();
    const amountCell = String(row[block.amountKey] ?? '').trim();
    const statusCell = String(row[block.statusKey] ?? '').trim();

    // A completely blank slot is "no history here", not an error.
    if (!schoolYear && !semester && !subjectsCell && !amountCell && !statusCell) continue;

    const { subjects, errors: subjectErrors } = parseSubjectCell(subjectsCell);
    for (const message of subjectErrors) errors.push(`${block.prefix} Subjects, ${message}`);

    const onHold = statusCell.toLowerCase().includes('hold');
    const amount = Number(amountCell || 0);

    if (subjects.length > 0) {
      grades.push({ schoolYear, semester, subjects, gwa: computeGwa(subjects) });
    }

    enrolledSemesters.push({
      schoolYear,
      semester,
      grantedAmount: onHold ? 0 : (Number.isFinite(amount) ? amount : 0),
      status: onHold ? 'on_hold' : 'disbursed',
      enrolledAt: termEnrolledAt(schoolYear, semester),
    });
  }

  enrolledSemesters.sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));
  grades.sort((a, b) =>
    termEnrolledAt(a.schoolYear, a.semester).localeCompare(termEnrolledAt(b.schoolYear, b.semester))
  );

  const earliest = enrolledSemesters[0] || null;
  const latest = enrolledSemesters[enrolledSemesters.length - 1] || null;

  return {
    grades,
    enrolledSemesters,
    errors,
    derived: {
      semestersUsed: enrolledSemesters.filter((e) => e.status === 'disbursed').length,
      grantSchoolYear: earliest ? earliest.schoolYear : null,
      yearAwarded: earliest ? Number(String(earliest.schoolYear).split('-')[0]) : null,
      latestSemester: latest ? latest.semester : null,
    },
  };
}
