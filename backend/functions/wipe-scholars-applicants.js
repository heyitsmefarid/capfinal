// Deletes every scholar and applicant user doc (plus applicant_history) and the
// Firebase Auth login of each one. Staff/viewer/admin docs, all config
// collections, audit logs, messages and group chats are left alone.
//
// Writes a JSON backup of everything it touches BEFORE deleting, so the wipe is
// recoverable. Run with GOOGLE_APPLICATION_CREDENTIALS pointing at a service
// account key:
//   node wipe-scholars-applicants.js            (dry run — lists, deletes nothing)
//   node wipe-scholars-applicants.js --confirm  (performs the deletion)

const fs = require('node:fs');
const path = require('node:path');
const { getFirebaseAdmin } = require('./src/config/firebase');

const KEEP_ROLES = new Set(['staff', 'viewer', 'admin', 'super_admin']);

function isScholarOrApplicant(data) {
  const role = String(data.role || '').toLowerCase();
  if (KEEP_ROLES.has(role)) return false;
  return role === 'scholar' || role === 'applicant' || data.studentType === 'scholar' || data.studentType === 'applicant';
}

async function run() {
  const confirmed = process.argv.includes('--confirm');
  const { db, auth } = getFirebaseAdmin();

  const snap = await db.collection('users').get();
  const targets = snap.docs.filter((d) => isScholarOrApplicant(d.data()));
  const kept = snap.docs.length - targets.length;

  let historyDocs = [];
  try {
    historyDocs = (await db.collection('applicant_history').get()).docs;
  } catch (_) { /* collection may not exist */ }

  const backupDir = path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `wipe-backup-${stamp}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        users: targets.map((d) => ({ id: d.id, data: d.data() })),
        applicant_history: historyDocs.map((d) => ({ id: d.id, data: d.data() })),
      },
      null,
      2
    )
  );
  console.log(`Backup written: ${backupFile} (${targets.length} user doc(s), ${historyDocs.length} history doc(s))`);

  console.log(`\nWould delete ${targets.length} user doc(s); keeping ${kept} (staff/viewer/admin):`);
  for (const d of targets) {
    const x = d.data();
    console.log(`  - ${(x.email || '(no email)').padEnd(34)} ${(x.role || x.studentType || '?').padEnd(10)} ${x.lastName || ''}`);
  }

  if (!confirmed) {
    console.log('\nDry run. Nothing deleted. Re-run with --confirm to delete.');
    return;
  }

  // Auth: only delete a login that belongs to one of these docs, matched by uid
  // AND email, so an unrelated account can never be caught by a stale uid.
  let authDeleted = 0;
  for (const d of targets) {
    const x = d.data();
    const uid = x.uid || d.id;
    if (!uid) continue;
    try {
      const user = await auth.getUser(uid);
      if (x.email && user.email && user.email.toLowerCase() !== String(x.email).toLowerCase()) {
        console.log(`  ! skipped auth ${uid}: email mismatch (${user.email} vs ${x.email})`);
        continue;
      }
      await auth.deleteUser(uid);
      authDeleted += 1;
    } catch (_) { /* no auth account for this doc */ }
  }

  let batch = db.batch();
  let n = 0;
  for (const d of [...targets, ...historyDocs]) {
    batch.delete(d.ref);
    n += 1;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();

  const after = await db.collection('users').get();
  console.log(`\nDeleted ${targets.length} user doc(s), ${historyDocs.length} applicant-history doc(s), ${authDeleted} Auth login(s).`);
  console.log(`users collection now holds ${after.size} doc(s):`);
  after.forEach((d) => console.log(`  kept: ${(d.data().email || d.id).padEnd(34)} ${d.data().role || d.data().studentType || '?'}`));
}

run().then(() => process.exit(0)).catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
