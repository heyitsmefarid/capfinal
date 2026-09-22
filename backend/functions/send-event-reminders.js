'use strict';

// Reminds scholars about tomorrow's events, one day ahead.
//
// This runs as a Render cron rather than from the admin panel on purpose: a
// reminder must go out whether or not an admin happens to have the panel open,
// and anything driven by an open browser tab fires zero times on a quiet day
// and once per tab on a busy one.
//
// Run:
//   GOOGLE_APPLICATION_CREDENTIALS=... node send-event-reminders.js
//   node send-event-reminders.js --dry-run     (lists, sends nothing)
//
// FIREBASE_SERVICE_ACCOUNT (full JSON) is also accepted, matching
// scheduled-backup.js, since that is how Render supplies the key.

const admin = require('firebase-admin');
const { sendPush } = require('./src/utils/push');

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (_) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
    }
    admin.initializeApp({ credential: admin.credential.cert(parsed) });
    return;
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS.
  admin.initializeApp();
}

// Date-only "YYYY-MM-DD" in local time, matching how the admin panel and the
// scholar app both store and read `date`.
function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function describe(event) {
  const when = event.startTime ? ` at ${event.startTime}` : '';
  return event.required
    ? `${event.name} is tomorrow${when}. Attendance is required.`
    : `${event.name} is tomorrow${when}.`;
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  initAdmin();
  const db = admin.firestore();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = isoDay(tomorrow);

  const snap = await db.collection('events').where('date', '==', target).get();
  if (snap.empty) {
    console.log(`No events on ${target} — nothing to remind about.`);
    return;
  }

  for (const doc of snap.docs) {
    const event = doc.data();
    const body = describe(event);
    console.log(`${dryRun ? '[dry run] ' : ''}${target}: ${event.name}`);
    if (dryRun) continue;

    const result = await sendPush(db, admin.messaging(), {
      audience: { allActiveScholars: true },
      title: 'Event tomorrow',
      body,
      data: { route: '/events', eventId: doc.id },
      // One reminder per event per day, however many times the cron runs.
      dedupeKey: `event-reminder:${doc.id}:${target}`,
    });
    console.log(`  → ${result.sent}/${result.targeted} sent` + (result.duplicate ? ' (already reminded today)' : ''));
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Event reminders failed:', e.message);
    process.exit(1);
  });
