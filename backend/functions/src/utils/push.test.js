'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { tokensFromUserDoc, isActiveScholar, isDeadTokenError, chunk, sendPush } = require('./push');

test('reads device tokens from the fcmTokens map', () => {
  assert.deepEqual(
    tokensFromUserDoc({ fcmTokens: { abc: { platform: 'android' }, def: { platform: 'android' } } }),
    ['abc', 'def']
  );
});

test('a scholar with no tokens yields none, whatever the field looks like', () => {
  assert.deepEqual(tokensFromUserDoc({}), []);
  assert.deepEqual(tokensFromUserDoc({ fcmTokens: null }), []);
  assert.deepEqual(tokensFromUserDoc({ fcmTokens: [] }), []);
  assert.deepEqual(tokensFromUserDoc({ fcmTokens: { '': {} } }), []);
});

test('on-hold scholars still count as an audience — that is how they learn what to fix', () => {
  assert.equal(isActiveScholar({ role: 'scholar', adminStatus: 'on-hold' }), true);
  assert.equal(isActiveScholar({ role: 'scholar', adminStatus: 'active' }), true);
  assert.equal(isActiveScholar({ studentType: 'scholar', status: 'approved' }), true);
});

test('staff, applicants and departed scholars are not an audience', () => {
  assert.equal(isActiveScholar({ role: 'staff', adminStatus: 'active' }), false);
  assert.equal(isActiveScholar({ role: 'applicant', adminStatus: 'pending' }), false);
  assert.equal(isActiveScholar({ role: 'scholar', adminStatus: 'terminated' }), false);
  assert.equal(isActiveScholar({ role: 'scholar', adminStatus: 'graduated' }), false);
});

test('recognises the errors that mean a device is gone for good', () => {
  assert.equal(isDeadTokenError({ code: 'messaging/registration-token-not-registered' }), true);
  assert.equal(isDeadTokenError({ code: 'messaging/invalid-registration-token' }), true);
  assert.equal(isDeadTokenError({ code: 'messaging/internal-error' }), false);
  assert.equal(isDeadTokenError(undefined), false);
});

test('splits into batches FCM will accept', () => {
  assert.equal(chunk(new Array(1200).fill('t')).length, 3);
  assert.deepEqual(chunk(['a', 'b', 'c'], 2), [['a', 'b'], ['c']]);
});

// ── sendPush against fakes ────────────────────────────────────────────────
function fakeDoc(id, data, onUpdate) {
  const ref = { id, update: async (patch) => { onUpdate?.(id, patch); } };
  return { id, exists: true, ref, data: () => data };
}

function fakeDb(docsById, updates) {
  return {
    collection: () => ({
      doc: async function () {},
      get: async () => ({
        forEach: (fn) => Object.entries(docsById).forEach(([id, d]) => fn(fakeDoc(id, d, (i, p) => updates.push([i, p])))),
      }),
    }),
  };
}

function dbWithDocLookup(docsById, updates) {
  return {
    collection: () => ({
      doc: (id) => ({ get: async () => (docsById[id] ? fakeDoc(id, docsById[id], (i, p) => updates.push([i, p])) : { exists: false }) }),
      get: fakeDb(docsById, updates).collection().get,
    }),
  };
}

test('sends to every device of the named scholars', async () => {
  const updates = [];
  const db = dbWithDocLookup({
    u1: { role: 'scholar', adminStatus: 'active', fcmTokens: { t1: {}, t2: {} } },
    u2: { role: 'scholar', adminStatus: 'active', fcmTokens: { t3: {} } },
  }, updates);
  const sentBatches = [];
  const messaging = {
    sendEachForMulticast: async (msg) => {
      sentBatches.push(msg);
      return { responses: msg.tokens.map(() => ({ success: true })) };
    },
  };

  const res = await sendPush(db, messaging, {
    audience: { uids: ['u1', 'u2'] },
    title: 'New announcement',
    body: 'Orientation moved to Friday',
    data: { route: '/announcements', id: 7 },
  });

  assert.deepEqual(res, { targeted: 3, sent: 3, failed: 0, pruned: 0 });
  assert.deepEqual(sentBatches[0].tokens.sort(), ['t1', 't2', 't3']);
  // Data values must be strings for FCM; the number above is coerced.
  assert.deepEqual(sentBatches[0].data, { route: '/announcements', id: '7' });
});

test('targets only active scholars when sending to everyone', async () => {
  const updates = [];
  const db = fakeDb({
    s1: { role: 'scholar', adminStatus: 'active', fcmTokens: { a: {} } },
    s2: { role: 'scholar', adminStatus: 'on-hold', fcmTokens: { b: {} } },
    gone: { role: 'scholar', adminStatus: 'terminated', fcmTokens: { c: {} } },
    staff: { role: 'staff', adminStatus: 'active', fcmTokens: { d: {} } },
  }, updates);
  const messaging = {
    sendEachForMulticast: async (msg) => ({ responses: msg.tokens.map(() => ({ success: true })) }),
  };

  const res = await sendPush(db, messaging, {
    audience: { allActiveScholars: true },
    title: 'x',
    body: 'y',
  });

  assert.equal(res.targeted, 2);
});

test('a dead token is pruned from its own scholar, and one failure does not sink the rest', async () => {
  const updates = [];
  const db = dbWithDocLookup({
    u1: { role: 'scholar', adminStatus: 'active', fcmTokens: { good: {}, dead: {} } },
  }, updates);
  const messaging = {
    sendEachForMulticast: async (msg) => ({
      responses: msg.tokens.map((t) => (t === 'dead'
        ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
        : { success: true })),
    }),
  };

  const res = await sendPush(db, messaging, { audience: { uids: ['u1'] }, title: 'x', body: 'y' });

  assert.equal(res.sent, 1);
  assert.equal(res.failed, 1);
  assert.equal(res.pruned, 1);
  assert.equal(updates.length, 1);
  assert.ok(Object.keys(updates[0][1])[0].includes('dead'));
});

test('a transient failure is reported but the token is kept', async () => {
  const updates = [];
  const db = dbWithDocLookup({ u1: { role: 'scholar', adminStatus: 'active', fcmTokens: { t: {} } } }, updates);
  const messaging = {
    sendEachForMulticast: async () => ({ responses: [{ success: false, error: { code: 'messaging/internal-error' } }] }),
  };

  const res = await sendPush(db, messaging, { audience: { uids: ['u1'] }, title: 'x', body: 'y' });

  assert.deepEqual(res, { targeted: 1, sent: 0, failed: 1, pruned: 0 });
  assert.equal(updates.length, 0);
});

test('nobody to notify is not an error', async () => {
  const db = dbWithDocLookup({ u1: { role: 'scholar', adminStatus: 'active' } }, []);
  const messaging = { sendEachForMulticast: async () => { throw new Error('must not be called'); } };
  assert.deepEqual(
    await sendPush(db, messaging, { audience: { uids: ['u1'] }, title: 'x', body: 'y' }),
    { targeted: 0, sent: 0, failed: 0, pruned: 0 }
  );
});

test('refuses to send a notification with no text', async () => {
  const db = dbWithDocLookup({}, []);
  await assert.rejects(
    () => sendPush(db, {}, { audience: { uids: [] }, title: '', body: 'y' }),
    /title and body are required/
  );
});

test('the same status change pushed from three admin tabs only sends once', async () => {
  const claimed = new Set();
  const created = [];
  const docsById = { u1: { role: 'scholar', adminStatus: 'on-hold', fcmTokens: { t: {} } } };
  const db = {
    collection: (name) => {
      if (name === 'push_dedupe') {
        return {
          doc: (key) => ({
            create: async () => {
              if (claimed.has(key)) throw new Error('already exists');
              claimed.add(key);
              created.push(key);
            },
          }),
        };
      }
      return {
        doc: (id) => ({
          get: async () => ({ exists: !!docsById[id], ref: { update: async () => {} }, data: () => docsById[id] }),
        }),
      };
    },
  };
  let sends = 0;
  const messaging = {
    sendEachForMulticast: async (msg) => { sends += 1; return { responses: msg.tokens.map(() => ({ success: true })) }; },
  };

  const send = () => sendPush(db, messaging, {
    audience: { uids: ['u1'] },
    title: 'On hold',
    body: 'Your scholarship is on hold',
    dedupeKey: 'status:u1:on-hold:2026-2027::1st Semester',
  });

  const first = await send();
  const second = await send();
  const third = await send();

  assert.equal(sends, 1, 'FCM should be called once, not once per tab');
  assert.equal(first.sent, 1);
  assert.equal(second.duplicate, true);
  assert.equal(third.duplicate, true);
  assert.deepEqual(created, ['status:u1:on-hold:2026-2027::1st Semester']);
});

test('a different term is a different push, not a duplicate', async () => {
  const claimed = new Set();
  const db = {
    collection: (name) => (name === 'push_dedupe'
      ? { doc: (key) => ({ create: async () => { if (claimed.has(key)) throw new Error('exists'); claimed.add(key); } }) }
      : { doc: () => ({ get: async () => ({ exists: true, ref: { update: async () => {} }, data: () => ({ role: 'scholar', adminStatus: 'active', fcmTokens: { t: {} } }) }) }) }),
  };
  const messaging = { sendEachForMulticast: async (m) => ({ responses: m.tokens.map(() => ({ success: true })) }) };

  const a = await sendPush(db, messaging, { audience: { uids: ['u1'] }, title: 'x', body: 'y', dedupeKey: 'status:u1:on-hold:2026-2027::1st Semester' });
  const b = await sendPush(db, messaging, { audience: { uids: ['u1'] }, title: 'x', body: 'y', dedupeKey: 'status:u1:on-hold:2026-2027::2nd Semester' });

  assert.equal(a.sent, 1);
  assert.equal(b.sent, 1);
  assert.equal(b.duplicate, undefined);
});
