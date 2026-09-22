// Parses the wide migration sheet's semester blocks into the shapes the app
// already reads (`grades[]` / `enrolledSemesters[]`). Pure functions with
// explicit params, matching the utils/granting.js convention, so the whole
// import can be unit-tested without Firestore or a browser.

export const VALID_REMARKS = ['Passed', 'Failed', 'Incomplete', 'Other'];

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
// `Name|Units|Grade|Remarks; Name|Units|Grade|Remarks`. Grade and Remarks are
// optional (2-4 fields) — a subject with no grade is "pending" and correctly
// falls out of computeGwa.
export function parseSubjectCell(cell) {
  const raw = String(cell ?? '').trim();
  if (!raw) return { subjects: [], errors: [] };

  const subjects = [];
  const errors = [];

  raw.split(';').map((e) => e.trim()).filter(Boolean).forEach((entry, i) => {
    const label = `entry ${i + 1}`;
    const parts = entry.split('|').map((p) => p.trim());

    if (parts.length < 2 || parts.length > 4) {
      errors.push(`${label} — expected Name|Units|Grade|Remarks (2-4 fields), got ${parts.length}`);
      return;
    }

    const [name, unitsRaw, gradeRaw = '', remarksRaw = ''] = parts;
    if (!name) {
      errors.push(`${label} — missing subject name`);
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

    const remarks = remarksRaw || 'Passed';
    if (!VALID_REMARKS.includes(remarks)) {
      errors.push(`${label} (${name}) — Remarks must be one of ${VALID_REMARKS.join(', ')}`);
      return;
    }

    subjects.push({ name, units, grade, remarks });
  });

  const seen = new Set();
  for (const subject of subjects) {
    const key = subject.name.toLowerCase();
    if (seen.has(key)) errors.push(`duplicate subject "${subject.name}" in the same term`);
    seen.add(key);
  }

  return { subjects, errors };
}
