'use strict';

async function getCurrentSchoolYearAndSemester(db) {
  const snap = await db.collection('school_years').where('isActive', '==', true).limit(1).get();
  if (snap.empty) return null;

  const yearDoc = snap.docs[0].data();
  const semesters = Array.isArray(yearDoc.semesters) ? yearDoc.semesters : [];
  const activeSemester = semesters.find((s) => s.isActive);
  if (!activeSemester) return null;

  const semesterIndex = Number(activeSemester.order) === 2 ? 2 : 1;
  // termKey matches the admin panel's countedTerms format (`${sy.label}::${sem.name}`).
  return { yearStart: Number(yearDoc.startYear), semesterIndex, termKey: `${yearDoc.label}::${activeSemester.name}` };
}

module.exports = { getCurrentSchoolYearAndSemester };
