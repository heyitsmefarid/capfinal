'use strict';

// Sending side of scholar push notifications. The Firebase project is on the
// Spark plan, so Cloud Functions can't deploy — this runs inside
// local-form-server.js (Render) instead, and the admin panel calls it.
//
// A scholar's devices live on their user doc as
//   fcmTokens: { "<token>": { platform, updatedAt } }
// a map rather than an array so adding the same device twice is a no-op and
// removing one doesn't need a read-modify-write.

const { COLLECTIONS } = require('../constants/collections');

// Matches the admin panel's notion of a scholar who should still hear from the
// office: on-hold scholars very much need to (that's how they learn what to fix).
const ACTIVE_SCHOLAR_STATUSES = ['active', 'approved', 'on-hold'];

// FCM rejects more than 500 messages in one multicast call.
const FCM_BATCH_LIMIT = 500;

function tokensFromUserDoc(data) {
  const raw = data && data.fcmTokens;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.keys(raw).filter((t) => typeof t === 'string' && t.trim() !== '');
}

function isScholarDoc(data) {
  if (!data) return false;
  const role = String(data.role || '').toLowerCase();
  if (role && role !== 'scholar') return false;
  return role === 'scholar' || data.studentType === 'scholar';
}

function isActiveScholar(data) {
  if (!isScholarDoc(data)) return false;
  const status = String(data.adminStatus || data.status || '').toLowerCase();
  return ACTIVE_SCHOLAR_STATUSES.includes(status);
}

// A token FCM says no longer exists should be deleted rather than retried
// forever — scholars reinstall, and dead tokens otherwise accumulate on the doc.
function isDeadTokenError(error) {
  const code = String((error && (error.code || error.errorInfo?.code)) || '');
  return (
    code.includes('registration-token-not-registered') ||
    code.includes('invalid-registration-token') ||
    code.includes('invalid-argument')
  );
}

function chunk(list, size = FCM_BATCH_LIMIT) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Reads the targeted scholars and returns every device token, remembering which
// doc each token came from so a dead one can be pruned from the right place.
async function collectTargets(db, audience) {
  const byToken = new Map();
  const add = (doc) => {
    for (const token of tokensFromUserDoc(doc.data())) byToken.set(token, doc.ref);
  };

  if (audience && Array.isArray(audience.uids) && audience.uids.length > 0) {
    const reads = await Promise.all(
      audience.uids.map((uid) => db.collection(COLLECTIONS.USERS).doc(String(uid)).get())
    );
    for (const doc of reads) if (doc.exists) add(doc);
    return byToken;
  }

  if (audience && audience.allActiveScholars) {
    const snap = await db.collection(COLLECTIONS.USERS).get();
    snap.forEach((doc) => { if (isActiveScholar(doc.data())) add(doc); });
    return byToken;
  }

  return byToken;
}

async function pruneTokens(deadByRef) {
  const { FieldValue } = require('firebase-admin').firestore;
  await Promise.all(
    [...deadByRef.entries()].map(([ref, tokens]) => {
      const update = {};
      for (const token of tokens) update[`fcmTokens.${token}`] = FieldValue.delete();
      return ref.update(update).catch(() => {});
    })
  );
}

/**
 * Sends one notification to an audience and prunes tokens FCM reports as dead.
 * Returns { targeted, sent, failed, pruned } — never throws for a partial
 * failure, so one stale device can't fail an announcement for everyone.
 */
async function sendPush(db, messaging, { audience, title, body, data = {} }) {
  if (!title || !body) throw new Error('title and body are required');

  const byToken = await collectTargets(db, audience);
  const tokens = [...byToken.keys()];
  if (tokens.length === 0) return { targeted: 0, sent: 0, failed: 0, pruned: 0 };

  const payloadData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );

  let sent = 0;
  let failed = 0;
  const deadByRef = new Map();

  for (const batch of chunk(tokens)) {
    const res = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data: payloadData,
      android: {
        priority: 'high',
        notification: { channelId: 'iskonnect_default' },
      },
    });

    res.responses.forEach((r, i) => {
      if (r.success) { sent += 1; return; }
      failed += 1;
      if (!isDeadTokenError(r.error)) return;
      const token = batch[i];
      const ref = byToken.get(token);
      if (!ref) return;
      if (!deadByRef.has(ref)) deadByRef.set(ref, []);
      deadByRef.get(ref).push(token);
    });
  }

  const pruned = [...deadByRef.values()].reduce((n, list) => n + list.length, 0);
  if (pruned > 0) await pruneTokens(deadByRef);

  return { targeted: tokens.length, sent, failed, pruned };
}

module.exports = {
  ACTIVE_SCHOLAR_STATUSES,
  FCM_BATCH_LIMIT,
  tokensFromUserDoc,
  isActiveScholar,
  isDeadTokenError,
  chunk,
  collectTargets,
  sendPush,
};
