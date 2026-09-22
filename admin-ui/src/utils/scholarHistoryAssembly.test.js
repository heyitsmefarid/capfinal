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
