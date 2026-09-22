import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImportRows } from './scholarImportValidation.js';

const baseRow = {
  'Scholar ID': '', 'First Name': 'Juan', 'Middle Name': '', 'Last Name': 'Dela Cruz',
  Email: 'juan@example.com', School: 'Mindoro State University', Program: 'BSIT',
  'Year Level': '2', Status: 'Active', 'Total Scholarship Semesters': '8', 'Active Scholarship Semesters': '2',
};

test('a fully valid row has no errors', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test('flags missing First Name, Last Name, invalid email, missing School/Program/Year Level', () => {
  const badRow = { ...baseRow, 'First Name': '', 'Last Name': '', Email: 'not-an-email', School: '', Program: '', 'Year Level': '' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Missing First Name'));
  assert.ok(result.errors.includes('Missing Last Name'));
  assert.ok(result.errors.includes('Invalid email format'));
  assert.ok(result.errors.includes('Missing School'));
  assert.ok(result.errors.includes('Missing Program'));
  assert.ok(result.errors.includes('Missing Year Level'));
});

test('flags Active Scholarship Semesters < 1', () => {
  const badRow = { ...baseRow, 'Active Scholarship Semesters': '0' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Semesters Granted must be at least 1'));
});

test('flags Total < Active semesters', () => {
  const badRow = { ...baseRow, 'Total Scholarship Semesters': '1', 'Active Scholarship Semesters': '2' };
  const [result] = validateImportRows([badRow], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Total Scholarship Semesters must be >= Semesters Granted'));
});

test('flags an email that already has an account', () => {
  const [result] = validateImportRows([baseRow], { existingEmails: new Set(['juan@example.com']), existingScholarIds: new Set() });
  assert.ok(result.errors.includes('Email already has an account'));
});

test('flags a Scholar ID that already exists', () => {
  const row = { ...baseRow, 'Scholar ID': '2026-00001' };
  const [result] = validateImportRows([row], { existingEmails: new Set(), existingScholarIds: new Set(['2026-00001']) });
  assert.ok(result.errors.includes('Scholar ID already exists'));
});

test('flags duplicate emails and duplicate Scholar IDs WITHIN the file', () => {
  const row2 = { ...baseRow, 'First Name': 'Maria', 'Last Name': 'Santos' };
  const [, second] = validateImportRows([baseRow, row2], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.errors.includes('Duplicate email within this file'));
});

test('warns (does not block) on same name+school appearing twice', () => {
  const [, second] = validateImportRows([baseRow, { ...baseRow, Email: 'other@example.com' }], { existingEmails: new Set(), existingScholarIds: new Set() });
  assert.ok(second.warnings.includes('Possible duplicate: same name + school already in this file'));
  assert.equal(second.valid, true);
});

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

test('blocks a new-template row that declares semesters but fills no blocks', () => {
  // The sheet has SY* columns (it's the new migration template), but every
  // block is left blank — Semesters Granted still claims 2 disbursed terms.
  const row = {
    ...baseRow,
    'Semesters Granted': '2',
    'SY1 School Year': '', 'SY1 Semester': '', 'SY1 Subjects': '', 'SY1 Amount Granted': '', 'SY1 Status': '',
    'SY2 School Year': '', 'SY2 Semester': '', 'SY2 Subjects': '', 'SY2 Amount Granted': '', 'SY2 Status': '',
  };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.some((e) => /Semesters Granted \(2\) does not match/.test(e)));
  assert.equal(result.valid, false);
  assert.equal(result.history, null);
});

test('flags a non-integer Year Level', () => {
  const row = { ...baseRow, 'Year Level': 'abc' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.includes('Year Level must be a positive integer'));
});

test('flags a zero or negative Year Level', () => {
  const row = { ...baseRow, 'Year Level': '0' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.includes('Year Level must be a positive integer'));
});

test('flags a non-numeric Total Scholarship Semesters', () => {
  const row = { ...baseRow, 'Total Scholarship Semesters': 'eight' };
  const [result] = validateImportRows([row], noExisting);
  assert.ok(result.errors.includes('Total Scholarship Semesters must be a number'));
});
