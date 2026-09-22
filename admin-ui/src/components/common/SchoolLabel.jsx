import { getSchoolAbbreviation } from '../../utils/schoolAbbreviations';

// Compact school name for tables/lists: renders the official abbreviation
// (e.g. "DWCC") with the full name available on hover via `title` — the
// underlying value is never changed, this is a display-only swap. Schools
// with no abbreviation on file just render their full name unchanged.
export default function SchoolLabel({ name, className, style }) {
  if (!name) return null;
  const abbr = getSchoolAbbreviation(name);
  if (!abbr) return <span className={className} style={style}>{name}</span>;
  return (
    <span className={className} style={style} title={name}>
      {abbr}
    </span>
  );
}
