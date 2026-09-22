// The migration import template's shape and its worked sample row. Kept out of
// Scholars.jsx so a test can import the exact data the admin downloads and run
// it through the real validator — the sample silently drifted out of the
// accepted format twice while it lived inline.

// 7 semester blocks (SY1..SY7) cover the observed 1-7 semester range. The
// parser discovers blocks from the header, so an admin can hand-add SY8
// columns without a code change.
export const TEMPLATE_SEMESTER_BLOCKS = 7;

export const TEMPLATE_PROFILE_COLUMNS = [
  'Scholar ID',
  'Last Name',
  'First Name',
  'Middle Name',
  'Suffix',
  'Date of Birth',
  'Sex',
  'Street',
  'Barangay',
  'Contact Number',
  'Email',
  'School',
  'Program',
  'Year Level',
  'Semesters Granted',
  'Total Scholarship Semesters',
  'Status',
];

export function buildTemplateHeader(blocks = TEMPLATE_SEMESTER_BLOCKS) {
  const header = [...TEMPLATE_PROFILE_COLUMNS];
  for (let n = 1; n <= blocks; n += 1) {
    header.push(
      `SY${n} School Year`,
      `SY${n} Semester`,
      `SY${n} Subjects`,
      `SY${n} Amount Granted`,
      `SY${n} Status`
    );
  }
  return header;
}

// One worked scholar the staff type over: two granted semesters, so the packed
// subject format and the Semesters Granted count are both visible. Per-term
// Status is left blank, which already means Disbursed — only On Hold is typed.
export function buildTemplateSampleRow(blocks = TEMPLATE_SEMESTER_BLOCKS) {
  const row = {};
  for (const key of buildTemplateHeader(blocks)) row[key] = '';

  Object.assign(row, {
    'Last Name': 'Dela Cruz',
    'First Name': 'Juan',
    'Middle Name': 'Santos',
    'Date of Birth': '2003-05-14',
    Sex: 'Male',
    Street: '12 Rizal Street',
    Barangay: 'Lalud',
    'Contact Number': '09171234567',
    Email: 'juan.delacruz@example.com',
    School: 'Divine Word College of Calapan',
    Program: 'BS in Information Technology',
    'Year Level': '2',
    'Semesters Granted': '2',
    'Total Scholarship Semesters': '8',
    Status: 'Active',

    'SY1 School Year': '2023-2024',
    'SY1 Semester': '1st Semester',
    'SY1 Subjects':
      'IT101|Programming 1|3|1.75|Passed; GEC102|Mathematics|3|2.00|Passed; PE101|PE 1|2|1.25|Passed',
    'SY1 Amount Granted': '25000',

    'SY2 School Year': '2023-2024',
    'SY2 Semester': '2nd Semester',
    'SY2 Subjects': 'IT102|Programming 2|3|1.50|Passed; GEC105|Rizal|3|1.75|Passed',
    'SY2 Amount Granted': '25000',
  });

  return row;
}
