// Official short-name abbreviations for HEIs, used ONLY in space-constrained
// UI (compact tables, filters, dropdowns) — display only. The full name
// stored on applicant/scholar records in Firestore is never touched, and
// filter/search matching still operates on that full name; this module just
// gives the UI a shorter label to render, plus an extra search alias so
// typing the abbreviation still finds the right records.
const ABBREVIATIONS = [
  ['Divine Word College of Calapan', 'DWCC'],
  ['Luna Goco Colleges, Inc.', 'LGC'],
  ['Southwestern College of Maritime, Business, and Technology', 'SCMBT'],
  ['St. Anthony College Calapan City, Inc.', 'SACCI'],
  ['ACLC College of Calapan', 'ACLC'],
  ['St. Mark Arts and Training Institute Inc.', 'SMARTI'],
  ['St. Augustine Seminary', 'SAS'],
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const ABBR_BY_FULL_NAME = new Map(ABBREVIATIONS.map(([full, abbr]) => [normalize(full), abbr]));

/**
 * The official abbreviation for a full school name, or null when this school
 * has none on file — callers should fall back to the full name in that case
 * (e.g. a school added later that hasn't been assigned a short label yet).
 */
export function getSchoolAbbreviation(fullName) {
  return ABBR_BY_FULL_NAME.get(normalize(fullName)) || null;
}

/**
 * Compact display label for tables/dropdowns: the abbreviation when one
 * exists, otherwise the original name unchanged.
 */
export function getSchoolDisplayLabel(fullName) {
  return getSchoolAbbreviation(fullName) || fullName || '';
}

/**
 * Extra term to add alongside a record's full school name wherever search
 * already checks that name, so searching "DWCC" still matches a record whose
 * stored `school` is "Divine Word College of Calapan".
 */
export function getSchoolSearchAlias(fullName) {
  return getSchoolAbbreviation(fullName) || '';
}
