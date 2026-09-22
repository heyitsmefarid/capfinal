import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverSemesterBlocks, parseSubjectCell, assembleScholarHistory, termEnrolledAt } from './scholarHistoryAssembly.js';

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

test('parses the full five-field subject form, course code first', () => {
  const { subjects, errors } = parseSubjectCell('MATH101|Math|3|1.75|Passed; ENG101|English|3|2.00|Passed');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [
    { code: 'MATH101', name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' },
    { code: 'ENG101', name: 'English', units: 3, grade: 2.0, remarks: 'Passed' },
  ]);
});

test('defaults remarks to Passed when omitted', () => {
  const { subjects, errors } = parseSubjectCell('MATH101|Math|3|1.75');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ code: 'MATH101', name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' }]);
});

test('treats a three-field subject as pending (no grade)', () => {
  const { subjects, errors } = parseSubjectCell('THS401|Thesis|3');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ code: 'THS401', name: 'Thesis', units: 3, grade: null, remarks: '' }]);
});

test('allows a blank course code when the slot is kept', () => {
  const { subjects, errors } = parseSubjectCell('|Math|3|1.75|Passed');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ code: '', name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' }]);
});

test('trims whitespace and ignores a trailing semicolon', () => {
  const { subjects, errors } = parseSubjectCell('  MATH101 | Math | 3 | 1.75 | Passed ; ');
  assert.deepEqual(errors, []);
  assert.deepEqual(subjects, [{ code: 'MATH101', name: 'Math', units: 3, grade: 1.75, remarks: 'Passed' }]);
});

test('an empty cell yields no subjects and no errors', () => {
  assert.deepEqual(parseSubjectCell(''), { subjects: [], errors: [] });
  assert.deepEqual(parseSubjectCell(null), { subjects: [], errors: [] });
});

test('reports a wrong field count', () => {
  const tooMany = parseSubjectCell('MATH101|Math|3|1.75|Passed|extra');
  assert.deepEqual(tooMany.subjects, []);
  assert.match(tooMany.errors[0], /entry 1 .*3-5 fields/);
  assert.match(parseSubjectCell('Math|3').errors[0], /entry 1 .*3-5 fields/);
});

test('rejects the old format without a course code instead of misreading it', () => {
  // Old 'Name|Units|Grade|Remarks' would otherwise read as code=Math, name=3.
  const { subjects, errors } = parseSubjectCell('Math|3|1.75|Passed');
  assert.deepEqual(subjects, []);
  assert.match(errors[0], /course code goes first/i);
});

test('reports non-numeric units and grade', () => {
  const units = parseSubjectCell('MATH101|Math|three|1.75|Passed');
  assert.match(units.errors[0], /Units must be a number/);
  const grade = parseSubjectCell('MATH101|Math|3|abc|Passed');
  assert.match(grade.errors[0], /Grade must be a number/);
});

test('reports zero or negative units', () => {
  assert.match(parseSubjectCell('MATH101|Math|0|1.75|Passed').errors[0], /Units must be a number greater than 0/);
  assert.match(parseSubjectCell('MATH101|Math|-3|1.75|Passed').errors[0], /Units must be a number greater than 0/);
});

test('reports an unrecognized remarks value', () => {
  const { errors } = parseSubjectCell('MATH101|Math|3|1.75|Excellent');
  assert.match(errors[0], /Remarks must be one of/);
});

test('reports a missing subject name', () => {
  const { errors } = parseSubjectCell('MATH101||3|1.75|Passed');
  assert.match(errors[0], /missing subject name/);
});

test('reports a duplicate subject within the same term', () => {
  const { errors } = parseSubjectCell('MATH101|Math|3|1.75|Passed; MATH102|math|3|2.00|Passed');
  assert.ok(errors.some((e) => /duplicate subject/i.test(e)));
});

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
    'SY1 Subjects': 'SUB1|Math|3|1.00|Passed; SUB2|English|3|2.00|Passed',
    'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '2nd Semester',
    'SY2 Subjects': 'SUB1|Rizal|3|1.50|Passed',
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
    'SY1 Subjects': 'SUB1|Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '2nd Semester',
    'SY2 Subjects': 'SUB1|Math|3|5.00|Failed', 'SY2 Amount Granted': '25000', 'SY2 Status': 'On Hold',
  };
  const { enrolledSemesters, derived } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(enrolledSemesters[1].status, 'on_hold');
  assert.equal(enrolledSemesters[1].grantedAmount, 0);
  assert.equal(derived.semestersUsed, 1);
});

test('skips an empty block slot', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'SUB1|Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
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
    'SY1 Subjects': 'SUB1|Thesis|3', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
  };
  const { grades } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(grades[0].gwa, null);
});

test('propagates subject-cell errors prefixed with the block name', () => {
  const row = {
    'SY1 School Year': '2023-2024', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'SUB1|Math|three|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
  };
  const { errors } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.match(errors[0], /^SY1 Subjects/);
});

test('sorts terms chronologically even when the blocks are filled out of order', () => {
  const row = {
    'SY1 School Year': '2024-2025', 'SY1 Semester': '1st Semester',
    'SY1 Subjects': 'SUB1|Math|3|1.00|Passed', 'SY1 Amount Granted': '25000', 'SY1 Status': 'Disbursed',
    'SY2 School Year': '2023-2024', 'SY2 Semester': '1st Semester',
    'SY2 Subjects': 'SUB1|English|3|1.00|Passed', 'SY2 Amount Granted': '25000', 'SY2 Status': 'Disbursed',
  };
  const { enrolledSemesters, derived } = assembleScholarHistory(row, discoverSemesterBlocks(BLOCK_HEADER));
  assert.equal(enrolledSemesters[0].schoolYear, '2023-2024');
  assert.equal(derived.grantSchoolYear, '2023-2024');
  assert.equal(derived.yearAwarded, 2023);
});

test('rejects Incomplete and Other remarks — only Passed and Failed are allowed', () => {
  assert.match(parseSubjectCell('SUB1|Math|3|3.00|Incomplete').errors[0], /Remarks must be one of Passed, Failed/);
  assert.match(parseSubjectCell('SUB1|Math|3|3.00|Other').errors[0], /Remarks must be one of Passed, Failed/);
  assert.deepEqual(parseSubjectCell('SUB1|Math|3|5.00|Failed').errors, []);
});
