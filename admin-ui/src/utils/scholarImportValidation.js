import { discoverSemesterBlocks, assembleScholarHistory } from './scholarHistoryAssembly.js';

const VALID_SEMESTERS = ['1st Semester', '2nd Semester'];

function readCell(row, ...names) {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}

// Both Excel and SheetJS's CSV parser turn a typed date into a numeric serial
// (days since 1899-12-30, plus a fractional timezone offset), so a perfectly
// good `2007-03-12` arrives here as 39153.33. Round to the nearest whole day —
// the fraction is a timezone artifact, not a time of day.
const EXCEL_MAX_SERIAL = 2958465; // 9999-12-31

export function normalizeImportRow(row) {
  const value = row['Date of Birth'];
  const serial = typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(serial) || serial < 1 || serial > EXCEL_MAX_SERIAL) return row;
  const asDate = new Date(Math.round((Math.round(serial) - 25569) * 86400000));
  if (Number.isNaN(asDate.getTime())) return row;
  return { ...row, 'Date of Birth': asDate.toISOString().slice(0, 10) };
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
    const yearLevel = readCell(row, 'Year Level');
    if (!yearLevel) errors.push('Missing Year Level');
    else if (!/^\d+$/.test(yearLevel) || Number(yearLevel) < 1) errors.push('Year Level must be a positive integer');

    const dateOfBirth = readCell(row, 'Date of Birth');
    if (dateOfBirth && Number.isNaN(new Date(dateOfBirth).getTime())) {
      errors.push('Date of Birth must be a valid date (YYYY-MM-DD)');
    }

    const semestersGranted = Number(readCell(row, 'Semesters Granted', 'Active Scholarship Semesters'));
    const totalSemesters = Number(readCell(row, 'Total Scholarship Semesters'));
    if (!Number.isFinite(semestersGranted) || semestersGranted < 1) {
      errors.push('Semesters Granted must be at least 1');
    }
    if (!Number.isFinite(totalSemesters)) {
      errors.push('Total Scholarship Semesters must be a number');
    } else if (totalSemesters < semestersGranted) {
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
      // The sheet IS the new migration template (it has SY* columns at all),
      // so the cross-check runs even when every block was left blank —
      // otherwise a row that declares "Semesters Granted: 4" but fills no
      // history imports silently with counts and no history. A genuine
      // legacy sheet has no SY* columns (blocks.length === 0) and skips this
      // whole branch, so it still imports with history: null and no error.
      const assembled = assembleScholarHistory(row, blocks);
      errors.push(...assembled.errors);
      if (assembled.enrolledSemesters.length > 0) history = assembled;
      // Cross-check against the row's own declared count. validateBlocks already
      // catches a filled block with a blank amount, so no per-term check belongs here.
      if (Number.isFinite(semestersGranted) && assembled.derived.semestersUsed !== semestersGranted) {
        errors.push(
          `Semesters Granted (${semestersGranted}) does not match the ${assembled.derived.semestersUsed} disbursed semester block(s) filled in`
        );
      }
    }

    return { index, row, errors, warnings, valid: errors.length === 0, history };
  });
}
