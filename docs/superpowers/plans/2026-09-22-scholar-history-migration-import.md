# Scholar Historical Data Migration Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin migrate a legacy scholar's full record — profile, per-semester subject grades, and per-semester grant history — from one wide Excel sheet into the live system in a single import.

**Architecture:** Extend the existing bulk-import path rather than replacing it. Two pure utility modules (block discovery + packed-cell parsing, then history assembly) do all the parsing and validation client-side; `Scholars.jsx` generates the new template and wires the utilities into the existing preview/chunked-submit flow; `scholarImport.js` writes the assembled `grades[]` / `enrolledSemesters[]` arrays and the previously-blank profile fields into the same `users` document it already creates.

**Tech Stack:** React 19 + Vite (admin-ui), `xlsx` (SheetJS) for workbook IO, SweetAlert2 for the preview modal, Firebase Cloud Functions v2 + Admin SDK (backend), `node:test` + `node:assert/strict` for unit tests.

**Spec:** `docs/superpowers/specs/2026-09-22-scholar-history-migration-import-design.md`

## Global Constraints

- **Never add a password column.** Temporary passwords are generated server-side by `generateTemporaryPassword(lastName, grantSchoolYear)` and returned in the credentials sheet. The template must not contain, accept, or display a password input.
- **GWA is always computed**, never read from the file — use the existing `computeGwa(subjects)` from `admin-ui/src/utils/academicRecords.js`. Do not reimplement the formula.
- **On-hold terms get `grantedAmount: 0`** regardless of the amount typed in the sheet, matching `getGrantBreakdown` in `admin-ui/src/utils/granting.js`.
- **Semester values are exactly** `1st Semester` and `2nd Semester`.
- **Valid remarks are exactly** `Passed`, `Failed`, `Incomplete`, `Other`; blank defaults to `Passed`.
- **School year format is** `YYYY-YYYY` with consecutive years (e.g. `2023-2024`).
- **Packed subject cell format:** `Name|Units|Grade|Remarks`, subjects separated by `;`. 2–4 fields per subject.
- **Block prefixes are** `SY1`…`SY{n}`; the parser discovers them from the header and must never hardcode 7.
- **Backward compatibility:** a row with no semester blocks must still import exactly as it does today. The backend's `history` payload is optional.
- **Column name compatibility:** the sheet's `Semesters Granted` column replaces `Active Scholarship Semesters`. Both spellings must be accepted everywhere (`pick()` on the backend already supports fallbacks).
- **Test command:** `cd admin-ui && npm test` (runs `node --test src/utils/*.test.js`).
- **Git note:** this project directory is **not a git repository** — `git rev-parse` resolves to `C:/Users/galla`. Resolve that with the user before running any commit step below. If a repo is initialized for the project, the commit commands work as written from the project root.

---

### Task 1: Semester block discovery and packed subject parsing

**Files:**
- Create: `admin-ui/src/utils/scholarHistoryAssembly.js`
- Test: `admin-ui/src/utils/scholarHistoryAssembly.test.js`

**Interfaces:**
- Consumes: nothing (first task).
- Produces:
  - `discoverSemesterBlocks(headerKeys: string[]) => Block[]` where `Block = { prefix, yearKey, semesterKey, subjectsKey, amountKey, statusKey }`, sorted by block number ascending.
  - `parseSubjectCell(cell: string) => { subjects: Subject[], errors: string[] }` where `Subject = { name: string, units: number, grade: number|null, remarks: string }`.
  - `VALID_REMARKS: string[]`

- [ ] **Step 1: Write the failing tests**

Create `admin-ui/src/utils/scholarHistoryAssembly.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverSemesterBlocks, parseSubjectCell } from './scholarHistoryAssembly.js';

test('discovers semester blocks from the header, sorted by number', () => {
  const header = [
    'Email', 'Last Name',
    'SY2 School Year', 'SY2 Semester', 'SY2 Subjects', 'SY2 Amount Granted', 'SY2 Status',
    'SY1 School Year', 'SY1 Semester', 'SY1 Subjects', 'SY1 Amount Granted', 'SY1 Status',
  ];
  const blocks = discoverSemesterBlocks(header);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].prefix, 'SY1');
  assert.equal(blocks[1].prefix, 'SY2');
  assert.equal(blocks[0].subjectsKey, 'SY1 Subjects');
  assert.equal(blocks[1].amountKey, 'SY2 Amount Granted');
});

test('discovers a hand-added SY8 block without a code change', () => {
  const header = ['SY1 School Year', 'SY8 School Year'];
  const blocks = discoverSemesterBlocks(header);
  assert.deepEqual(blocks.map((b) => b.prefix), ['SY1', 'SY8']);
});

test('returns no blocks when the header has none', () => {
  assert.deepEqual(discoverSemesterBlocks(['Email', 'Last Name']), []);
});

test('parses the full four-field subject form', () => {
  const { subjects, errors } = parseSubjectCell('Math|3|1.75|Passed; English|3|2.00|Passed');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [
    { name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' },
    { name: 'English', units: 3, grade: 2.0, remarks: 'Passed' },
  ]);
});

test('defaults remarks to Passed when omitted', () => {
  const { subjects, errors } = parseSubjectCell('Math|3|1.75');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' }]);
});

test('treats a two-field subject as pending (no grade)', () => {
  const { subjects, errors } = parseSubjectCell('Thesis|3');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ name: 'Thesis', units: 3, grade: null, remarks: 'Passed' }]);
});

test('trims whitespace and ignores a trailing semicolon', () => {
  const { subjects, errors } = parseSubjectCell('  Math | 3 | 1.75 | Passed ; ');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' }]);
});

test('an empty cell yields no subjects and no errors', () => {
  assert.deepEqual(parseSubjectCell(''), { subjects: [], errors: [] });
  assert.deepEqual(parseSubjectCell(null), { subjects: [], errors: [] });
});

test('reports a wrong field count', () => {
  const { subjects, errors } = parseSubjectCell('Math|3|1.75|Passed|extra');
  assert.deepEqual(subjects, []);
  assert.match(errors[0], /entry 1 .*2-4 fields/);
});

test('reports non-numeric units and grade', () => {
  const units = parseSubjectCell('Math|three|1.75|Passed');
  assert.match(units.errors[0], /Units must be a number/);
  const grade = parseSubjectCell('Math|3|abc|Passed');
  assert.match(grade.errors[0], /Grade must be a number/);
});

test('reports zero or negative units', () => {
  const { errors } = parseSubjectCell('Math|0|1.75|Passed');
  assert.match(errors[0], /Units must be a number greater than 0/);
});

test('reports an unrecognized remarks value', () => {
  const { errors } = parseSubjectCell('Math|3|1.75|Excellent');
  assert.match(errors[0], /Remarks must be one of/);
});

test('reports a missing subject name', () => {
  const { errors } = parseSubjectCell('|3|1.75|Passed');
  assert.match(errors[0], /missing subject name/);
});

test('reports a duplicate subject within the same term', () => {
  const { errors } = parseSubjectCell('Math|3|1.75|Passed; math|3|2.00|Passed');
  assert.ok(errors.some((e) => /duplicate subject/i.test(e)));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-ui && npm test`
Expected: FAIL — `Cannot find module './scholarHistoryAssembly.js'`

- [ ] **Step 3: Write the implementation**

Create `admin-ui/src/utils/scholarHistoryAssembly.js`:

```js
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-ui && npm test`
Expected: PASS — all tests in `scholarHistoryAssembly.test.js` green, and the pre-existing `scholarImportValidation.test.js` still green.

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/utils/scholarHistoryAssembly.js admin-ui/src/utils/scholarHistoryAssembly.test.js
git commit -m "feat: parse semester blocks and packed subject cells for scholar migration import"
```

---

### Task 2: Assemble a scholar's history payload

**Files:**
- Modify: `admin-ui/src/utils/scholarHistoryAssembly.js` (append)
- Test: `admin-ui/src/utils/scholarHistoryAssembly.test.js` (append)

**Interfaces:**
- Consumes: `discoverSemesterBlocks`, `parseSubjectCell`, `VALID_REMARKS` from Task 1; `computeGwa(subjects)` from `./academicRecords.js`.
- Produces:
  - `termEnrolledAt(schoolYear: string, semester: string) => string` (ISO timestamp)
  - `assembleScholarHistory(row: object, blocks: Block[]) => { grades, enrolledSemesters, derived, errors }` where `derived = { semestersUsed, grantSchoolYear, yearAwarded, latestSemester }`.

- [ ] **Step 1: Write the failing tests**

Append to `admin-ui/src/utils/scholarHistoryAssembly.test.js`:

```js
import { assembleScholarHistory, termEnrolledAt } from './scholarHistoryAssembly.js';

const BLOCK_HEADER = [
  'SY1 School Year', 'SY1 Semester', 'SY1 Subjects', 'SY1 Amount Granted', 'SY1 Status',
  'SY2 School Year', 'SY2 Semester', 'SY2 Subjects', 'SY2 Amount Granted', 'SY2 Status',
];

test('termEnrolledAt orders 1st before 2nd semester, and years in sequence', () => {
  const first = termEnrolledAt('2023-2024', '1st Semester');
  const second = termEnrolledAt('2023-2024', '2nd Semester');
  const nextYear = termEnrolledAt('2024-2025', '1st Semester');
  assert.ok(first < second);
  assert.ok(second < nextYear);
});

test('assembles grades and enrolledSemesters from two filled blocks', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Math|3|1.00|Passed; English|3|2.00|Passed',
    'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '2nd Semester',
    'SY2 Subjects': 'Rizal|3|1.50|Passed',
    'SY2 Amount Granted': '25000', 'SY2 Status': 'Disbursed',
  };
  const { grades, enrolledSemesters, derived, errors } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));

  assert.deepEqual(errors, []);
  assert.equal(grades.length, 2);
  assert.equal(grades[0].schoolYear, '2023-2024');
  assert.equal(grades[0].subjects.length, 2);
  assert.equal(grades[0].gwa, '1.50');
  assert.equal(enrolledSemesters.length, 2);
  assert.equal(enrolledSemesters[0].grantedAmount, 25000);
  assert.equal(enrolledSemesters[0].status, 'disbursed');
  assert.equal(derived.semestersUsed, 2);
  assert.equal(derived.grantSchoolYear, '2023-2024');
  assert.equal(derived.yearAwarded, 2023);
  assert.equal(derived.latestSemester, '2nd Semester');
});

test('an on-hold block is recorded with a zero amount and excluded from semestersUsed', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '2nd Semester',
    'SY2 Subjects': 'Math|3|5.00|Failed', 'SY2 Amount Granted': '25000', 'SY2 Status': 'On Hold',
  };
  const { enrolledSemesters, derived } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(enrolledSemesters[1].status, 'on_hold');
  assert.equal(enrolledSemesters[1].grantedAmount, 0);
  assert.equal(derived.semestersUsed, 1);
});

test('skips an empty block slot', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '', 'SY2 Semester': '', 'SY2 Subjects': '', 'SY2 Amount Granted': '', 'SY2 Status': '',
  };
  const { grades, enrolledSemesters, errors } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.deepEqual(errors, []);
  assert.equal(grades.length, 1);
  assert.equal(enrolledSemesters.length, 1);
});

test('a block with subjects but no grade values still produces a term with a null gwa', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Thesis|3', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
  };
  const { grades } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(grades[0].gwa, null);
});

test('propagates subject-cell errors prefixed with the block name', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Math|three|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
  };
  const { errors } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.match(errors[0], /^SY1 Subjects/);
});

test('sorts terms chronologically even when the blocks are filled out of order', () => {
  const row = {
    'SY1 School Year': '2024-2025', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '1st Semester',
    'SY2 Subjects': 'English|3|1.00|Passed', 'SY2 Amount Granted': '25000', 'SY2 Status': 'Disbursed',
  };
  const { enrolledSemesters, derived } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(enrolledSemesters[0].schoolYear, '2023-2024');
  assert.equal(derived.grantSchoolYear, '2023-2024');
  assert.equal(derived.yearAwarded, 2023);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-ui && npm test`
Expected: FAIL — `assembleScholarHistory is not a function` (and `termEnrolledAt is not a function`)

- [ ] **Step 3: Write the implementation**

Append to `admin-ui/src/utils/scholarHistoryAssembly.js`:

```js
import { computeGwa } from './academicRecords.js';

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
```

Move the `import { computeGwa }` line to the top of the file with the other imports (the append above places it mid-file for readability of this plan only).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-ui && npm test`
Expected: PASS — all assembly tests green.

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/utils/scholarHistoryAssembly.js admin-ui/src/utils/scholarHistoryAssembly.test.js
git commit -m "feat: assemble scholar grades and enrolled semesters from migration sheet rows"
```

---

### Task 3: Extend row validation for the new columns and blocks

**Files:**
- Modify: `admin-ui/src/utils/scholarImportValidation.js`
- Test: `admin-ui/src/utils/scholarImportValidation.test.js`

**Interfaces:**
- Consumes: `discoverSemesterBlocks`, `assembleScholarHistory` from Tasks 1–2.
- Produces: `validateImportRows(rows, { existingEmails, existingScholarIds })` — same signature as today, but each result gains a `history` property (`{ grades, enrolledSemesters, derived }`) when the row has semester blocks, and new error strings.

- [ ] **Step 1: Write the failing tests**

Append to `admin-ui/src/utils/scholarImportValidation.test.js`:

```js
const historyRow = {
  ...baseRow,
  'Semesters Granted': '2',
  'Total Scholarship Semesters': '8',
  'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
  'SY1 Subjects': 'Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
  'SY2 School Year': '2023-2024', 'SY2 Semester': '2nd Semester',
  'SY2 Subjects': 'Rizal|3|1.50|Passed', 'SY2 Amount Granted': '25000', 'SY2 Status': 'Disbursed',
};
const noExisting = { existingEmails: new Set(), existingScholarIds: new Set() };

test('a valid history row passes and carries its assembled history', () => {
  const [result] = validateImportRows([historyRow], noExisting);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
  assert.equal(result.history.grades.length, 2);
  assert.equal(result.history.enrolledSemesters.length, 2);
  assert.equal(result.history.derived.semestersUsed, 2);
});

test('accepts the legacy Active Scholarship Semesters column name', () => {
  const legacy = { ...historyRow };
  legacy['Active Scholarship Semesters'] = legacy['Semesters Granted'];
  delete legacy['Semesters Granted'];
  const [result] = validateImportRows([legacy], noExisting);
  assert.deepEqual(result.errors, []);
});

test('blocks a row whose Disbursed block count disagrees with Semesters Granted', () => {
  const row = { ...historyRow, 'Semesters Granted': '3' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /Semesters Granted \(3\) does not match/.test(e)));
  assert.equal(result.valid, false);
});

test('blocks an invalid school year format', () => {
  const row = { ...historyRow, 'SY1 School Year': '2023' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 School Year/.test(e)));
});

test('blocks non-consecutive school years', () => {
  const row = { ...historyRow, 'SY1 School Year': '2023-2025' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 School Year/.test(e)));
});

test('blocks an unrecognized semester value', () => {
  const row = { ...historyRow, 'SY1 Semester': 'Summer' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 Semester/.test(e)));
});

test('blocks a duplicate term across two blocks', () => {
  const row = { ...historyRow, 'SY2 Semester': '1st Semester' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /appears twice/.test(e)));
});

test('blocks a negative or non-numeric amount', () => {
  const row = { ...historyRow, 'SY1 Amount Granted': '-5' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 Amount Granted/.test(e)));
});

test('blocks a block that has subjects but no amount', () => {
  const row = { ...historyRow, 'SY1 Amount Granted': '' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 Amount Granted/.test(e)));
});

test('surfaces packed-cell errors on the row', () => {
  const row = { ...historyRow, 'SY1 Subjects': 'Math|three|1.00|Passed' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /SY1 Subjects/.test(e)));
});

test('blocks an unparseable Date of Birth', () => {
  const row = { ...historyRow, 'Date of Birth': '31/02/2001' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /Date of Birth/.test(e)));
});

test('a row with no semester blocks still validates (legacy file)', () => {
  const [result] = validateImportRows([{ ...baseRow }], noExisting);
  assert.deepEqual(result.errors, []);
  assert.equal(result.history, null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd admin-ui && npm test`
Expected: FAIL — the new assertions fail (no `history` property, no block errors).

- [ ] **Step 3: Write the implementation**

Replace the contents of `admin-ui/src/utils/scholarImportValidation.js`:

```js
import { discoverSemesterBlocks, assembleScholarHistory } from './scholarHistoryAssembly.js';

const VALID_SEMESTERS = ['1st Semester', '2nd Semester'];

function readCell(row, ...names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

// `YYYY-YYYY` with the second year immediately following the first.
function isValidSchoolYear(value) {
  const match = /^(\d{4})-(\d{4})$/.exec(value);
  return !!match && Number(match[2]) === Number(match[1]) + 1;
}

function validateBlocks(row, blocks) {
  const errors = [];
  const seenTerms = new Set();

  for (const block of blocks) {
    const schoolYear = readCell(row, block.yearKey);
    const semester = readCell(row, block.semesterKey);
    const subjects = readCell(row, block.subjectsKey);
    const amount = readCell(row, block.amountKey);
    const status = readCell(row, block.statusKey);

    if (!schoolYear && !semester && !subjects && !amount && !status) continue;

    if (!isValidSchoolYear(schoolYear)) {
      errors.push(`${block.prefix} School Year must be formatted YYYY-YYYY with consecutive years`);
    }
    if (!VALID_SEMESTERS.includes(semester)) {
      errors.push(`${block.prefix} Semester must be "1st Semester" or "2nd Semester"`);
    }

    const termKey = `${schoolYear}::${semester}`;
    if (seenTerms.has(termKey)) errors.push(`${schoolYear} ${semester} appears twice in this row`);
    seenTerms.add(termKey);

    const amountValue = Number(amount);
    if (amount === '' || !Number.isFinite(amountValue) || amountValue < 0) {
      errors.push(`${block.prefix} Amount Granted must be a number of 0 or more`);
    }
  }

  return errors;
}

export function validateImportRows(rows, { existingEmails, existingScholarIds }) {
  const seenEmails = new Set();
  const seenScholarIds = new Set();
  const seenNameSchool = new Set();
  const blocks = discoverSemesterBlocks(Object.keys(rows[0] || {}));

  return rows.map((row, index) => {
    const errors = [];
    const warnings = [];
    const email = readCell(row, 'Email').toLowerCase();
    const scholarId = readCell(row, 'Scholar ID');
    const firstName = readCell(row, 'First Name');
    const lastName = readCell(row, 'Last Name');
    const nameSchoolKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}::${readCell(row, 'School').toLowerCase()}`;

    if (!firstName) errors.push('Missing First Name');
    if (!lastName) errors.push('Missing Last Name');
    if (!email) errors.push('Missing Email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    if (!readCell(row, 'School')) errors.push('Missing School');
    if (!readCell(row, 'Program')) errors.push('Missing Program');
    if (!readCell(row, 'Year Level')) errors.push('Missing Year Level');

    const dateOfBirth = readCell(row, 'Date of Birth');
    if (dateOfBirth && Number.isNaN(new Date(dateOfBirth).getTime())) {
      errors.push('Date of Birth must be a valid date (YYYY-MM-DD)');
    }

    const semestersGranted = Number(readCell(row, 'Semesters Granted', 'Active Scholarship Semesters'));
    const totalSemesters = Number(readCell(row, 'Total Scholarship Semesters'));
    if (!Number.isFinite(semestersGranted) || semestersGranted < 1) {
      errors.push('Semesters Granted must be at least 1');
    }
    if (totalSemesters < semestersGranted) {
      errors.push('Total Scholarship Semesters must be >= Semesters Granted');
    }

    if (email && existingEmails.has(email)) errors.push('Email already has an account');
    if (email && seenEmails.has(email)) errors.push('Duplicate email within this file');
    if (scholarId && existingScholarIds.has(scholarId)) errors.push('Scholar ID already exists');
    if (scholarId && seenScholarIds.has(scholarId)) errors.push('Duplicate Scholar ID within this file');
    if (seenNameSchool.has(nameSchoolKey)) warnings.push('Possible duplicate: same name + school already in this file');

    seenEmails.add(email);
    seenScholarIds.add(scholarId);
    seenNameSchool.add(nameSchoolKey);

    errors.push(...validateBlocks(row, blocks));

    let history = null;
    if (blocks.length > 0) {
      const assembled = assembleScholarHistory(row, blocks);
      errors.push(...assembled.errors);
      if (assembled.enrolledSemesters.length > 0) {
        history = assembled;
        // A term the scholar has grades for but no grant record would render in
        // Academic Records with no Semester Record behind it.
        for (const term of assembled.enrolledSemesters) {
          const block = blocks.find(
            (b) => readCell(row, b.yearKey) === term.schoolYear && readCell(row, b.semesterKey) === term.semester
          );
          if (block && readCell(row, b_amount(block)) === '' && readCell(row, block.subjectsKey) !== '') {
            errors.push(`${block.prefix} Amount Granted is required when the term has subjects`);
          }
        }
        if (Number.isFinite(semestersGranted) && assembled.derived.semestersUsed !== semestersGranted) {
          errors.push(
            `Semesters Granted (${semestersGranted}) does not match the ${assembled.derived.semestersUsed} disbursed semester block(s) filled in`
          );
        }
      }
    }

    return { index, row, errors, warnings, valid: errors.length === 0, history };
  });
}

function b_amount(block) {
  return block.amountKey;
}
```

Note for the implementer: `b_amount` is a trivial accessor introduced only to keep the nested lookup readable — inline it as `block.amountKey` and delete the helper. Deduplicate the `Amount Granted` error if `validateBlocks` already produced one for the same block (a `Set` over the error strings before returning is the simplest fix; add it if a test shows a duplicate message).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd admin-ui && npm test`
Expected: PASS — new block/history tests plus every pre-existing test in this file, except the two that assert the old `Active Scholarship Semesters` wording. Update those two assertions to the new `Semesters Granted` messages.

- [ ] **Step 5: Commit**

```bash
git add admin-ui/src/utils/scholarImportValidation.js admin-ui/src/utils/scholarImportValidation.test.js
git commit -m "feat: validate migration sheet profile columns, semester blocks, and grant counts"
```

---

### Task 4: Generate the wide template with a sample row

**Files:**
- Modify: `admin-ui/src/pages/Scholars.jsx:785-809` (`handleDownloadTemplate`)

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SheetJS output), but the column names must match Task 3's `readCell` lookups and Task 1's `SY{n} ` prefixes exactly.
- Produces: `scholar_migration_import_template.xlsx` — a single `Scholars` sheet, 52 columns, one sample row.

- [ ] **Step 1: Replace `handleDownloadTemplate`**

```jsx
  // 7 semester blocks (SY1..SY7) cover the observed 1-7 semester range. The
  // parser discovers blocks from the header, so an admin can hand-add SY8
  // columns without a code change.
  const TEMPLATE_SEMESTER_BLOCKS = 7;

  const handleDownloadTemplate = () => {
    const sample = {
      'Scholar ID': '',
      'Last Name': 'Dela Cruz',
      'First Name': 'Juan',
      'Middle Name': 'Santos',
      Suffix: '',
      'Date of Birth': '2003-05-14',
      Sex: 'Male',
      Street: '12 Rizal Street',
      Barangay: 'Barangay Lalud',
      'Contact Number': '09171234567',
      Email: 'juan.delacruz@example.com',
      School: 'Divine Word College of Calapan',
      Program: 'BS in Information Technology',
      'Year Level': '2',
      'Semesters Granted': '2',
      'Total Scholarship Semesters': '8',
      Status: 'Active',
    };

    for (let n = 1; n <= TEMPLATE_SEMESTER_BLOCKS; n += 1) {
      sample[`SY${n} School Year`] = '';
      sample[`SY${n} Semester`] = '';
      sample[`SY${n} Subjects`] = '';
      sample[`SY${n} Amount Granted`] = '';
      sample[`SY${n} Status`] = '';
    }

    // Two worked semesters so staff can see the packed subject format.
    sample['SY1 School Year'] = '2023-2024';
    sample['SY1 Semester'] = '1st Semester';
    sample['SY1 Subjects'] = 'Programming 1|3|1.75|Passed; Mathematics|3|2.00|Passed; PE 1|2|1.25|Passed';
    sample['SY1 Amount Granted'] = '25000';
    sample['SY1 Status'] = 'Disbursed';
    sample['SY2 School Year'] = '2023-2024';
    sample['SY2 Semester'] = '2nd Semester';
    sample['SY2 Subjects'] = 'Programming 2|3|1.50|Passed; Rizal|3|1.75|Passed';
    sample['SY2 Amount Granted'] = '25000';
    sample['SY2 Status'] = 'Disbursed';

    const ws = XLSX.utils.json_to_sheet([sample]);
    ws['!cols'] = Object.keys(sample).map((key) => ({
      wch: key.endsWith('Subjects') ? 60 : Math.max(14, key.length + 2),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Scholars');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      'scholar_migration_import_template.xlsx'
    );
  };
```

- [ ] **Step 2: Verify the generated file by hand**

Run the admin (`cd admin-ui && npm run dev`), open Scholars, click **Template**, and open the download.
Expected: one `Scholars` sheet; headers `Scholar ID` → `SY7 Status` (52 columns); one sample row with SY1 and SY2 filled and SY3–SY7 blank; the `Subjects` columns wide enough to read.

- [ ] **Step 3: Commit**

```bash
git add admin-ui/src/pages/Scholars.jsx
git commit -m "feat: emit wide migration template with profile, semester blocks, and a sample row"
```

---

### Task 5: Wire the importer to parse, preview, and submit history

**Files:**
- Modify: `admin-ui/src/pages/Scholars.jsx:832-929` (`handleFileChange`)

**Interfaces:**
- Consumes: `validateImportRows` (now returning `history`) from Task 3.
- Produces: rows POSTed to `bulkCreateScholars` each carrying `__history` — `{ grades, enrolledSemesters, derived }` or absent.

- [ ] **Step 1: Add the history summary to the preview and attach `__history`**

In `handleFileChange`, replace the `previewHtml` block and the `importRows` mapping:

```jsx
      const previewHtml = `
        <div style="max-height:300px;overflow:auto;text-align:left;font-size:0.85em">
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th>Row</th><th>Name</th><th>History</th><th>Status</th></tr></thead>
            <tbody>
              ${validated.map((r) => {
                const h = r.history;
                const terms = h ? h.enrolledSemesters.length : 0;
                const subjects = h ? h.grades.reduce((n, g) => n + g.subjects.length, 0) : 0;
                const total = h ? h.enrolledSemesters.reduce((n, e) => n + e.grantedAmount, 0) : 0;
                const historyLabel = terms
                  ? `${terms} term(s) · ${subjects} subject(s) · ₱${total.toLocaleString()}`
                  : 'no history';
                return `
                <tr style="color:${r.valid ? (r.warnings.length ? '#b8860b' : '#2e7d32') : '#c62828'}">
                  <td>${r.index + 1}</td>
                  <td>${escapeHtml(r.row['First Name'])} ${escapeHtml(r.row['Last Name'])}</td>
                  <td>${escapeHtml(historyLabel)}</td>
                  <td>${escapeHtml(r.errors.concat(r.warnings).join('; ')) || 'OK'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
```

and:

```jsx
      const importRows = okRows.map((r) => (r.history ? { ...r.row, __history: r.history } : r.row));
```

- [ ] **Step 2: Verify the preview in the running app**

Run the admin, click **Template**, fill (or keep) the sample row, then **Import Scholars** and cancel at the review modal.
Expected: the review table shows a History column reading `2 term(s) · 5 subject(s) · ₱50,000` for the sample row. Nothing is written because you cancelled.

- [ ] **Step 3: Commit**

```bash
git add admin-ui/src/pages/Scholars.jsx
git commit -m "feat: preview migrated history counts and send assembled history with the import"
```

---

### Task 6: Persist history and profile fields on the backend

**Files:**
- Modify: `backend/functions/src/http/scholarImport.js:151-226`

**Interfaces:**
- Consumes: `row.__history` = `{ grades, enrolledSemesters, derived }` from Task 5 (optional).
- Produces: a `users` document that additionally carries `grades`, `enrolledSemesters`, the real profile fields, and history-derived scalars.

- [ ] **Step 1: Read the history payload and derive the scalars from it**

Immediately after the existing `activeScholarshipSemesters` block, insert:

```js
          const history = row.__history && typeof row.__history === 'object' ? row.__history : null;
          const grades = Array.isArray(history?.grades) ? history.grades : [];
          const enrolledSemesters = Array.isArray(history?.enrolledSemesters) ? history.enrolledSemesters : [];
          const semestersGranted = history?.derived?.semestersUsed ?? activeScholarshipSemesters;
```

Then make the grant-year derivation prefer the history, leaving today's
backward-stepping estimate as the no-history fallback — replace the existing
`grantSchoolYear` / `yearAwarded` / `academicYear` lines with:

```js
          const grantSchoolYear =
            history?.derived?.grantSchoolYear ||
            computeGrantSchoolYear(currentTerm.yearStart, currentTerm.semesterIndex, activeScholarshipSemesters);
          const yearAwarded = history?.derived?.yearAwarded || Number(grantSchoolYear.split('-')[0]);
          const academicYear = grantSchoolYear;
```

Also accept the new column name where `activeScholarshipSemesters` is read:

```js
          const activeScholarshipSemesters =
            parseInt(pick(row, 'Semesters Granted', 'Active Scholarship Semesters'), 10) || 0;
```

- [ ] **Step 2: Write the new fields into the document**

In the `db.collection(COLLECTIONS.USERS).doc(userRecord.uid).set({ ... })` call, change
`semestersCompleted`, `semestersUsed`, and the blank profile fields, and add the two arrays:

```js
            semestersCompleted: semestersGranted,
            semestersUsed: semestersGranted,
            grades,
            enrolledSemesters,
            // Profile fields from the migration sheet (previously left blank for
            // the scholar to fill in-app).
            suffix: pick(row, 'Suffix'),
            dateOfBirth: pick(row, 'Date of Birth'),
            gender: pick(row, 'Sex', 'Gender'),
            contactNumber: pick(row, 'Contact Number'),
            street: pick(row, 'Street'),
            barangay: pick(row, 'Barangay'),
            houseNo: '',
            city: '',
            province: '',
```

Remove the now-duplicated `suffix: ''`, `gender: ''`, `contactNumber: ''`, `street: ''`, `barangay: ''` lines so each key appears exactly once.

- [ ] **Step 3: Verify against the Firebase emulator**

```bash
cd backend/functions && npm run serve
```

In a second terminal: `cd admin-ui && npm run dev:emu`, then import the sample template through the UI.
Expected: import reports `Created: 1`; the emulator's Firestore shows the new `users` doc with a 2-entry `grades` array, a 2-entry `enrolledSemesters` array, `semestersUsed: 2`, `grantSchoolYear: "2023-2024"`, and the populated `dateOfBirth` / `gender` / `contactNumber` / `street` / `barangay`.

- [ ] **Step 4: Verify the legacy path still works**

Import a file containing only the old 11 columns (no `SY1 …` headers).
Expected: `Created: 1`, the doc has `grades: []`, `enrolledSemesters: []`, and `grantSchoolYear` derived from the active term as before.

- [ ] **Step 5: Commit**

```bash
git add backend/functions/src/http/scholarImport.js
git commit -m "feat: persist migrated grade and grant history on bulk-created scholars"
```

---

### Task 7: End-to-end verification in the admin UI

**Files:** none modified — this task is verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: a confirmed working migration path, or a list of defects to fix before sign-off.

- [ ] **Step 1: Build a realistic sample sheet**

Download the template and fill in four scholars:
1. one semester of history only;
2. seven semesters (all blocks filled);
3. one with an `On Hold` term carrying a `Failed` subject;
4. one with a pending subject (`Thesis|3`, no grade).

- [ ] **Step 2: Import against the emulator and confirm the preview**

Run `npm run dev:emu`, click **Import Scholars**, and read the review modal.
Expected: all four rows green, History column showing the right term/subject counts and peso totals; the on-hold scholar's total excludes that term.

- [ ] **Step 3: Confirm the data renders on every page that reads it**

- **Scholars → View → Records:** each scholar shows one row per term with its subjects and GWA.
- **Academic Records:** the migrated terms appear; the failed subject counts under Failed/Incomplete; the pending subject is not counted as Passed.
- **Granting:** per-semester amounts match the sheet; the on-hold term shows ₱0; the lifetime total equals the sum of the Disbursed amounts.

- [ ] **Step 4: Confirm the credentials sheet**

Download it from the result dialog.
Expected: one row per created scholar with an auto-generated temporary password and no password column anywhere in the *import* template.

- [ ] **Step 5: Confirm re-run safety**

Import the exact same file a second time.
Expected: every row reports `skipped — Email already has an account`; no duplicate scholars and no doubled history.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address defects found during end-to-end migration import verification"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §4.1 profile columns | Tasks 3, 4, 6 |
| §4.2 semester blocks, header discovery | Tasks 1, 4 |
| §4.3 packed subject format | Task 1 |
| §4.4 sample row | Task 4 |
| §5 mapping to `grades[]`/`enrolledSemesters[]`/derived | Tasks 2, 6 |
| §5 profile fields written for real | Task 6 |
| §5 backward compatibility | Tasks 3, 6 (Step 4) |
| §6 validation rules | Tasks 1, 3 |
| §7 components | Tasks 1–6 |
| §8 flow incl. preview summary | Task 5 |
| §9 re-run safety | Task 7 Step 5 |
| §10 testing | Tasks 1–3 (unit), 7 (manual) |

**Type consistency:** `Block` fields (`prefix`, `yearKey`, `semesterKey`, `subjectsKey`, `amountKey`, `statusKey`) are produced in Task 1 and consumed unchanged in Tasks 2 and 3. `Subject` is `{ name, units, grade, remarks }` throughout. `history` is `{ grades, enrolledSemesters, derived, errors }` from Task 2, attached as `__history` (without `errors` mattering) in Task 5, and read as `row.__history` in Task 6. `derived.semestersUsed` / `derived.grantSchoolYear` / `derived.yearAwarded` are named identically in Tasks 2, 3, and 6.

**Known rough edge carried into execution:** Task 3's `b_amount` helper is flagged inline for removal, and the possible duplicate `Amount Granted` message is called out with its fix. Both are resolved during Task 3 Step 4 rather than deferred.
