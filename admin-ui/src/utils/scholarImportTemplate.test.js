import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATE_SEMESTER_BLOCKS,
  buildTemplateHeader,
  buildTemplateSampleRow,
} from './scholarImportTemplate.js';
import { discoverSemesterBlocks } from './scholarHistoryAssembly.js';
import { validateImportRows } from './scholarImportValidation.js';

const noExisting = { existingEmails: new Set(), existingScholarIds: new Set() };

test('the header is 17 profile columns plus 5 per semester block', () => {
  const header = buildTemplateHeader();
  assert.equal(header.length, 17 + TEMPLATE_SEMESTER_BLOCKS * 5);
  assert.equal(header[0], 'Scholar ID');
  assert.ok(header.includes('Semesters Granted'));
  assert.ok(!header.some((h) => /password/i.test(h)), 'the template must never carry a password column');
});

test('every block the header declares is discovered by the parser', () => {
  const blocks = discoverSemesterBlocks(buildTemplateHeader());
  assert.equal(blocks.length, TEMPLATE_SEMESTER_BLOCKS);
  const header = new Set(buildTemplateHeader());
  for (const b of blocks) {
    for (const key of [b.yearKey, b.semesterKey, b.subjectsKey, b.amountKey, b.statusKey]) {
      assert.ok(header.has(key), `${key} is missing from the template header`);
    }
  }
});

test('the sample row imports cleanly through the real validator', () => {
  const [result] = validateImportRows([buildTemplateSampleRow()], noExisting);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.valid, true);
});

test('the sample row produces the history its Semesters Granted promises', () => {
  const [result] = validateImportRows([buildTemplateSampleRow()], noExisting);
  const { grades, enrolledSemesters, derived } = result.history;

  assert.equal(enrolledSemesters.length, 2);
  assert.equal(derived.semestersUsed, Number(buildTemplateSampleRow()['Semesters Granted']));
  assert.equal(enrolledSemesters.every((e) => e.status === 'disbursed'), true);
  assert.equal(enrolledSemesters.reduce((n, e) => n + e.grantedAmount, 0), 50000);

  assert.equal(grades.length, 2);
  assert.equal(grades.reduce((n, g) => n + g.subjects.length, 0), 5);
  assert.equal(grades[0].subjects.every((s) => s.code && s.name), true, 'every sample subject needs a course code');
  // (1.75*3 + 2.00*3 + 1.25*2) / 8 units
  assert.equal(grades[0].gwa, '1.72');
});

test('unused semester blocks are present but empty', () => {
  const row = buildTemplateSampleRow();
  for (let n = 3; n <= TEMPLATE_SEMESTER_BLOCKS; n += 1) {
    assert.equal(row[`SY${n} School Year`], '');
    assert.equal(row[`SY${n} Subjects`], '');
  }
});
