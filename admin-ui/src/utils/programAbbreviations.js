// Compact display label for a program name, used ONLY in space-constrained
// UI (compact tables, filters, dropdowns, reports) — display only. The full
// name stored on applicant/scholar records in Firestore is never touched,
// and filter/search matching still operates on that full name.
//
// Only programs that literally start with "Bachelor of Science" are
// shortened to "BS" — anything else (Bachelor of Arts, Associate, etc.) is
// left exactly as stored.
const BS_PREFIX = /^Bachelor of Science\b\s*/i;

export function getProgramDisplayLabel(programName) {
  const name = String(programName || '').trim();
  if (!name) return name;
  if (!BS_PREFIX.test(name)) return name;
  const rest = name.replace(BS_PREFIX, '').trim();
  return rest ? `BS ${rest}` : 'BS';
}
