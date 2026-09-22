// Financial/granting helpers — moved out of Scholars.jsx verbatim (Pass 11)
// so the Granting page can use them without duplicating the logic. Pure
// functions with explicit params instead of closures over useApp(), matching
// the existing utils/academicRecords.js and utils/scholarActivity.js
// convention. No behavior change from the original Scholars.jsx versions.

// Fallback cap used only when the admin hasn't configured a base amount yet
// (systemSettings.scholarshipCap, System Settings > General Config) AND the
// scholar's program has no per-program Tuition Cap of its own on file. Every
// function below takes the live settings value as a parameter instead of
// hardcoding this — see AppContext.jsx's `scholarshipCap` Firestore sync.
export const SCHOLARSHIP_CAP = 25000;

/**
 * Looks up the tuition cap configured for the scholar's program in the
 * shared Academic Programs catalog (matched by program name, then school).
 */
export function getProgramTuitionCap(scholar, catalogPrograms) {
  const programs = catalogPrograms || [];
  const match =
    programs.find((p) => p.name === scholar?.program && p.school === scholar?.school) ||
    programs.find((p) => p.name === scholar?.program);
  return Math.max(0, Number(match?.tuitionCap) || 0);
}

/**
 * The ceiling a scholar's grant is capped at — the specific program's
 * configured Tuition Cap when known, otherwise the admin-configured base
 * scholarshipCap (or the hardcoded fallback). This is the *uncapped* ceiling
 * — unlike computeReflectedAmount, it is NOT already min()'d against the
 * scholar's actual tuition, which is what makes it useful for comparing
 * "how much of the cap is actually being used" (see Reports.jsx's Unused
 * Grant Monitoring report).
 */
export function getApplicableCap(scholar, catalogPrograms, scholarshipCap = SCHOLARSHIP_CAP) {
  const match =
    (catalogPrograms || []).find((p) => p.name === scholar?.program && p.school === scholar?.school) ||
    (catalogPrograms || []).find((p) => p.name === scholar?.program);
  const baseCap = Math.max(0, Number(scholarshipCap) || 0) || SCHOLARSHIP_CAP;
  return match?.tuitionCap != null ? Math.max(0, Number(match.tuitionCap) || 0) : baseCap;
}

/**
 * Caps at the specific program's configured Tuition Cap when known, falling
 * back to the admin-configured base scholarshipCap (System Settings) — or
 * the hardcoded SCHOLARSHIP_CAP if that hasn't loaded yet — otherwise.
 * Mirrors AppContext.jsx's resolvePerSemGrant so this preview never
 * disagrees with what actually gets persisted when a semester is granted.
 */
export function computeReflectedAmount(tuitionFee, school, program, catalogPrograms, scholarshipCap = SCHOLARSHIP_CAP) {
  const normalizedTuition = Math.max(0, Number(tuitionFee) || 0);
  const match =
    (catalogPrograms || []).find((p) => p.name === program && p.school === school) ||
    (catalogPrograms || []).find((p) => p.name === program);
  const baseCap = Math.max(0, Number(scholarshipCap) || 0) || SCHOLARSHIP_CAP;
  const cap = match?.tuitionCap != null ? Math.max(0, Number(match.tuitionCap) || 0) : baseCap;
  return Math.min(normalizedTuition, cap);
}

/**
 * The tuition fee to bill against: the scholar's own value when an admin
 * has set one, otherwise the program's configured cap from System Settings.
 */
export function getEffectiveTuition(scholar, catalogPrograms) {
  const explicit = Math.max(0, Number(scholar?.tuitionFee) || 0);
  return explicit > 0 ? explicit : getProgramTuitionCap(scholar, catalogPrograms);
}

/**
 * Per-semester grant: an explicit amountGranted wins; otherwise it's the
 * capped reflection of the effective tuition (program cap, or the
 * admin-configured base scholarshipCap).
 */
export function getPerSemGranted(scholar, catalogPrograms, scholarshipCap = SCHOLARSHIP_CAP) {
  const explicitGrant = Math.max(0, Number(scholar?.amountGranted) || 0);
  return explicitGrant > 0
    ? explicitGrant
    : computeReflectedAmount(getEffectiveTuition(scholar, catalogPrograms), scholar?.school, scholar?.program, catalogPrograms, scholarshipCap);
}

// Per-semester grant breakdown, one row per enrolled semester, oldest first.
// School year label is derived from its chronological position: 1st granted
// term = "1st Semester" of the scholar's starting year, 2nd = "2nd
// Semester", then the next school year, etc.
export function getGrantBreakdown(scholar, perSemGranted) {
  const enrolled = [...(scholar?.enrolledSemesters || [])].sort((a, b) =>
    String(a.enrolledAt || '').localeCompare(String(b.enrolledAt || ''))
  );
  const startYear =
    parseInt(String(scholar?.schoolYear || '').split('-')[0], 10) ||
    Number(scholar?.yearAwarded) ||
    new Date().getFullYear();

  const semesterRows = enrolled.map((entry, i) => {
    const sy = startYear + Math.floor(i / 2); // new school year every 2 sems
    const isOnHold = entry.status === 'on_hold';
    return {
      schoolYear: entry.schoolYear || `${sy}-${sy + 1}`,
      semester: entry.semester || (i % 2 === 0 ? '1st Semester' : '2nd Semester'),
      // On-hold semesters receive no grant; use stored amount otherwise.
      grantedAmount: isOnHold ? 0 : (typeof entry.grantedAmount === 'number' ? entry.grantedAmount : (perSemGranted || 0)),
      status: entry.status || 'disbursed',
    };
  });

  const totalsByYear = semesterRows.reduce((acc, row) => {
    acc[row.schoolYear] = (acc[row.schoolYear] || 0) + row.grantedAmount;
    return acc;
  }, {});

  const yearRows = Object.entries(totalsByYear)
    .map(([schoolYear, totalGranted]) => ({ schoolYear, totalGranted }))
    .sort((a, b) => String(a.schoolYear).localeCompare(String(b.schoolYear)));

  return { semesterRows, yearRows };
}

/**
 * A scholar's actual total amount granted to date: the sum of every stored
 * per-semester `grantedAmount` (on-hold semesters contribute 0), NOT
 * `semestersUsed * currentGrant` — semesters granted under an older fee stay
 * at their historical amount. This is the one place Reports.jsx (and anyone
 * else) should compute a scholar's lifetime total, so a report can never
 * disagree with what Granting.jsx/Scholars.jsx display for the same scholar.
 */
export function getTotalGranted(scholar, catalogPrograms, scholarshipCap = SCHOLARSHIP_CAP) {
  const perSemGranted = getPerSemGranted(scholar, catalogPrograms, scholarshipCap);
  const { semesterRows } = getGrantBreakdown(scholar, perSemGranted);
  return semesterRows.reduce((sum, row) => sum + row.grantedAmount, 0);
}
