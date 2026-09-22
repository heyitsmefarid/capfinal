# Scholar Historical Data Migration Import — Design

> Status: proposed, awaiting sign-off before `writing-plans`.

## 1. Goal

Let an admin migrate legacy scholar records — including each scholar's
per-semester subject grades and per-semester scholarship grant history — into
the live system in one pass, from a single Excel sheet.

Today's bulk import creates a scholar account with *counts* only
(`semestersUsed`, `totalScholarshipSemesters`). A migrated scholar therefore
lands in the system with no Semester Records, no grade history, and no grant
breakdown — the adviser's requirement is that this history comes across, not
just the headline numbers. This is visible in live data right now: 13 scholars
all read `2/8` semesters, but only 4 have any grade history behind that number.

This is **not a greenfield build**. `bulkCreateScholars`
(`backend/functions/src/http/scholarImport.js`) already does Excel-row parsing,
name splitting, Scholar ID sequencing, Firebase Auth account creation,
auto-generated temporary passwords, and audit logging;
`admin-ui/src/pages/Scholars.jsx` already does template download, client-side
validation, a preview-before-commit modal, and chunked submission. This spec
extends that path rather than replacing it.

## 2. What already exists (findings that shape this design)

- **Target shape is already defined by the app.** `AcademicRecords.jsx` and
  `Scholars.jsx` read a `grades[]` array — one entry per school year +
  semester, each with a `subjects[]` array of `{ name, units, grade, remarks }`
  and a `gwa`. `granting.js` reads an `enrolledSemesters[]` array — one entry
  per term with `grantedAmount`, `status`, and `enrolledAt`. The migration
  writes these existing arrays; it introduces no new collection and no new
  read path.
- **`computeGwa(subjects)`** (`utils/academicRecords.js`) is the single
  units-weighted GWA implementation, already shared by AcademicRecords and
  Scholars. Subjects with a non-numeric grade fall out of the average.
- **On-hold terms receive no grant.** `getGrantBreakdown` forces
  `grantedAmount: 0` when `status === 'on_hold'`, and `getTotalGranted` sums
  the stored per-semester amounts rather than multiplying a current rate. Any
  imported history must respect that, or migrated totals will disagree with
  what the Granting page shows.
- **Passwords are already auto-generated.** `generateTemporaryPassword(lastName,
  grantSchoolYear)` runs server-side, `mustChangePassword: true` is set on the
  new doc, and the admin gets a downloadable credentials sheet. The template
  has no password column and must not gain one.
- **Scholar IDs are server-generated** (`YYYY-00001`) when the file doesn't
  supply one.
- **Imported scholars can log in.** The gap recorded in
  `2026-07-28-scholar-import-account-activation-design.md` has since been
  closed — the scholar app has a real Firebase Auth flow with a forced password
  change. This migration has no blocking dependency on that work.
- **The current importer hardcodes profile fields blank.** `suffix`, `gender`,
  `contactNumber`, `street`, `barangay` are written as `''`, and date of birth
  is not written at all. The adviser's field list requires all of them.

## 3. Scope

**In scope:** a single-sheet wide import template carrying profile *and*
history; parsing and validation of that sheet; assembly of `grades[]` /
`enrolledSemesters[]` / derived counts; writing the additional profile fields;
a preview that summarizes each scholar's history before anything is committed.

**Out of scope:** changing how the app *renders* history (it already does);
editing an already-migrated scholar's history through the importer (use the
existing Academic Records encode/edit UI); merging history into scholars that
already exist (this migration creates scholars one-shot — an existing email is
skipped, as today).

## 4. Import file format

**One sheet, named `Scholars`, one row per scholar** — profile and full history
on the same row. Chosen over a normalized multi-sheet workbook at the product
owner's direction: staff fill in one place, with nothing to cross-reference.

### 4.1 Profile columns (17)

| # | Column | Required | Notes |
|---|---|---|---|
| A | Scholar ID | no | blank ⇒ auto-assigned `YYYY-00001` |
| B | Last Name | yes | |
| C | First Name | yes | |
| D | Middle Name | no | |
| E | Suffix | no | Jr., III, … |
| F | Date of Birth | no | `YYYY-MM-DD` |
| G | Sex | no | Male / Female |
| H | Street | no | |
| I | Barangay | no | |
| J | Contact Number | no | |
| K | Email | yes | unique; the Auth account is created from it |
| L | School | yes | |
| M | Program | yes | |
| N | Year Level | yes | integer |
| O | Semesters Granted | yes | must equal the Disbursed semester blocks filled in |
| P | Total Scholarship Semesters | yes | entitlement cap; must be ≥ Semesters Granted |
| Q | Status | no | Active (default) / On Hold |

**Ambiguity resolved:** the adviser's "total number of semesters granted" is
split into two columns, because the system already distinguishes them and
conflating them corrupts the grant math. `Semesters Granted` is how many terms
the scholar actually received (→ `semestersUsed`); `Total Scholarship
Semesters` is the maximum they are entitled to (→ the `x/8 sem` badge in the
scholar app).

No password column — see §2.

### 4.2 Semester blocks (5 columns each, repeated)

Columns R onward repeat in blocks of five, one block per semester of history:

| Column | Example | Notes |
|---|---|---|
| `SY1 School Year` | `2023-2024` | `YYYY-YYYY`, consecutive years |
| `SY1 Semester` | `1st Semester` | `1st Semester` / `2nd Semester` |
| `SY1 Subjects` | `Math\|3\|1.75\|Passed; English\|3\|2.00\|Passed` | packed — see §4.3 |
| `SY1 Amount Granted` | `25000` | number ≥ 0 |
| `SY1 Status` | `Disbursed` | Disbursed (default) / On Hold — On Hold forces the amount to 0 |

The generated template ships **7 blocks** (`SY1`…`SY7`, columns R–AZ, 52 columns
total), matching the observed 1–7 semester range. The parser does **not**
hardcode 7: it discovers blocks by scanning the header for the `SY{n} ` prefix,
so a hand-added `SY8` block imports correctly without a code change. A block
whose School Year is blank is skipped as "no history for this slot".

### 4.3 Packed subject format

Each `SY{n} Subjects` cell holds that term's subjects, **separated by `;`**,
with each subject's fields **separated by `|`**:

```
Subject Name | Units | Grade | Remarks ;  Subject Name | Units | Grade | Remarks
```

- `Math|3|1.75|Passed; English|3|2.00|Passed` — two subjects
- `Math|3|1.75` — Remarks omitted, defaults to `Passed`
- `Math|3` — no grade yet (a pending subject; excluded from the GWA)

Whitespace around separators is trimmed. Trailing `;` is ignored. This packing
is the one real cost of the single-sheet layout — a malformed cell invalidates
that whole semester, so §6 reports the exact subject and reason.

### 4.4 Sample row

The downloaded template contains **one worked sample row** (Juan Dela Cruz,
with two semesters of history filled in) that staff type over — matching the
current template's behavior.

## 5. Mapping into the `users` document

Per scholar, for each filled semester block:

- **`grades[]`** ← the block's School Year, Semester, and parsed Subjects:
  `{ schoolYear, semester, subjects: [{ name, units, grade, remarks }], gwa }`.
  `gwa` is **computed** via the existing `computeGwa(subjects)`, never taken
  from the file, so a transcription error can't make a displayed GWA disagree
  with the subjects behind it.
- **`enrolledSemesters[]`** ← the block's School Year, Semester, Amount
  Granted, Status:
  `{ schoolYear, semester, grantedAmount, status: 'disbursed' | 'on_hold', enrolledAt }`.
  `grantedAmount` is forced to 0 for `on_hold`, matching `getGrantBreakdown`.
  `enrolledAt` is synthesized from the term's chronological position (ISO
  string) so the existing `enrolledAt` sort in `getGrantBreakdown` orders
  migrated terms correctly.
- **Derived scalars:**
  - `semestersUsed` / `semestersCompleted` = count of Disbursed blocks
  - `totalScholarshipSemesters` = `Total Scholarship Semesters`
  - `grantSchoolYear` / `yearAwarded` / `academicYear` = the **earliest** term
    in the history, replacing the backward-stepping estimate from the active
    term (that estimate stays for rows carrying no history at all — see
    Backward compatibility — but a migrated scholar always has at least one
    block, so it never applies to this template)
  - `yearLevel`, `semester` = from the profile columns / the latest term
- **Profile fields now written for real:** `suffix`, `dateOfBirth`, `gender`
  (from Sex), `contactNumber`, `street`, `barangay`.

Everything else in the created doc (Auth account, auto-generated temporary
password, role/claims, `scholarId`, `mustChangePassword`, `status`, audit log)
is unchanged.

**Backward compatibility.** The `history` payload is optional on the backend.
A row without it (an old-format file with no semester blocks) is created
exactly as it is today, including the backward-stepping `grantSchoolYear`
derivation — so the endpoint keeps working for non-migration imports.

## 6. Validation rules

Validation runs over the whole sheet before anything is written.

**Profile columns** (extends the current `validateImportRows`): required fields
present; valid email format; email not already registered and not duplicated
in-file; Scholar ID (if given) not already taken and not duplicated in-file;
`Total Scholarship Semesters` ≥ `Semesters Granted` ≥ 1; Year Level a positive
integer; Date of Birth parseable when present. Same-name-same-school remains a
warning, not an error.

**Semester blocks:** `School Year` matches `YYYY-YYYY` with consecutive years;
`Semester` is a recognized value; `Amount Granted` numeric and ≥ 0; no two
filled blocks share the same (School Year, Semester); a block with a School
Year must also have a Semester.

**Packed subject cells:** each `;`-separated entry splits into 2–4 `|` fields;
Subject Name non-empty; Units numeric and > 0; Grade numeric when present;
Remarks one of Passed / Failed / Incomplete / Other when present; no duplicate
subject name within one term. Errors name the offending block and subject
(e.g. *"SY2 Subjects, entry 3 — Units must be a number"*).

**Cross-column totals:** the count of Disbursed blocks must equal `Semesters
Granted` — a mismatch is an **error that blocks that scholar**, not a warning,
so migrated totals are trustworthy from day one. A block with subjects but no
Amount Granted is also an error: the term would render in Academic Records with
no Semester Record behind it.

Errors are per-scholar: an invalid row is skipped with its reasons listed, and
the rest of the sheet still imports (the current file's behavior).

## 7. Components

| File | Change |
|---|---|
| `admin-ui/src/utils/scholarImportValidation.js` | extend `validateImportRows` for the new profile columns and the semester-block/packed-subject rules |
| `admin-ui/src/utils/scholarHistoryAssembly.js` | **new, pure** — discovers `SY{n}` blocks from the header, parses packed subject cells, and assembles each scholar's `{ grades, enrolledSemesters, derived }` payload |
| `admin-ui/src/utils/*.test.js` | unit tests for both of the above (`npm test` already runs `node --test src/utils/*.test.js`) |
| `admin-ui/src/pages/Scholars.jsx` | `handleDownloadTemplate` emits the 52-column sheet with the sample row; `handleFileChange` parses blocks, validates, assembles, and shows a per-scholar history summary in the existing preview modal |
| `admin-ui/src/services/backendApi.js` | `bulkCreateScholars` rows carry an optional assembled `history` object |
| `backend/functions/src/http/scholarImport.js` | write `grades`, `enrolledSemesters`, derived scalars, and the new profile fields into the created `users` doc |

The two new/extended utils are pure functions with explicit params — matching
the existing `utils/granting.js` and `utils/academicRecords.js` convention — so
parsing, assembly, and validation are testable without Firestore or a browser.

## 8. Flow

1. Admin clicks **Template** on the Scholars page → 52-column sheet with one
   sample row.
2. Admin fills it in and clicks **Import Scholars**.
3. Client parses the sheet, discovers the semester blocks, parses packed
   subject cells, and runs validation.
4. Client assembles each valid scholar's history payload (GWA computed here,
   via the one shared `computeGwa`).
5. Preview modal: per scholar — name, status, and a history summary
   (*"6 terms · 32 subjects · ₱150,000 total"*), plus every error/warning.
   Nothing has been written yet.
6. On confirm, rows POST to `bulkCreateScholars` in chunks of 50 (as today)
   with live progress.
7. Backend creates the Auth account with an auto-generated temporary password
   and writes the `users` doc **including its history**, in one `.set()`.
8. Result summary + downloadable credentials sheet (existing behavior).

## 9. Error handling and re-run safety

- **No partial scholars.** History is written in the same document `.set()`
  that creates the scholar, so a scholar can never exist with half a history.
- **Re-runnable.** An email that already has an Auth account is skipped with a
  reason, so re-running the same sheet after a partial failure creates no
  duplicates and no doubled history.
- **Nothing silent.** Every skipped or failed row surfaces in the result
  summary with its reason; the chunked loop reports per-chunk totals as it
  goes.
- **Audit.** The existing bulk-import audit log entry records the migration.

## 10. Testing

- **Unit (`npm test`):** header block discovery, including a hand-added `SY8`;
  packed-cell parsing for the 2-, 3-, and 4-field forms and malformed input;
  GWA computation including pending (blank-grade) subjects; on-hold blocks
  forced to a 0 amount; derived counts and earliest-year derivation; each
  validation rule, including the Disbursed-count mismatch and
  subjects-without-amount errors.
- **Manual, against a sample sheet:** import a handful of scholars with varied
  history lengths (1 block, 7 blocks, an on-hold term, a failed subject), then
  verify in the admin UI that Scholars → Records, Academic Records, and
  Granting all show the migrated history, and that the Granting total matches
  the sum in the sheet.

## 11. Decisions on record

| Question | Decision |
|---|---|
| Template layout | **One wide sheet**, 1 row per scholar, 7 semester blocks (revised — was a 3-sheet normalized workbook) |
| Subjects | Packed one cell per term: `Name\|Units\|Grade\|Remarks; …` |
| Block count | Template ships 7; parser discovers blocks from the header, so more can be added by hand |
| Sample data | One worked sample row that staff type over |
| Passwords | Auto-generated server-side (already true) — no password column, ever |
| GWA | Computed from imported subjects, never read from the file |
| Grant count mismatch | Hard error that blocks the affected scholar |
| "Total semesters granted" | Split into `Semesters Granted` (used) and `Total Scholarship Semesters` (entitlement) |
| Existing scholars | Out of scope — one-shot creation; existing emails are skipped |
