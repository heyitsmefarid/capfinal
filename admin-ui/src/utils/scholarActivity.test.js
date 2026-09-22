import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLastActivity, isInactiveGraduate } from './scholarActivity.js';

test('computeLastActivity returns null when nothing is on record', () => {
  assert.equal(computeLastActivity({}, []), null);
  assert.equal(computeLastActivity({ firestoreId: 'abc' }, []), null);
});

test('computeLastActivity falls back to the archive date alone', () => {
  const scholar = { archivedDate: '2024-01-15T00:00:00.000Z' };
  const result = computeLastActivity(scholar, []);
  assert.equal(result.toISOString(), new Date('2024-01-15T00:00:00.000Z').toISOString());
});

test('computeLastActivity picks the latest of archive date, COR/COG submissions, and scholar-sent messages', () => {
  const scholar = {
    firestoreId: 'scholar-1',
    archivedDate: '2023-01-01T00:00:00.000Z',
    cogSubmissions: [{ uploadedAt: '2023-06-01T00:00:00.000Z' }],
    corSubmissions: [{ uploadedAt: '2023-03-01T00:00:00.000Z' }],
  };
  const messages = [
    { fromUserId: 'scholar-1', createdAt: '2024-02-01T00:00:00.000Z' }, // latest
    { fromUserId: 'scholar-1', createdAt: '2022-01-01T00:00:00.000Z' },
  ];
  const result = computeLastActivity(scholar, messages);
  assert.equal(result.toISOString(), new Date('2024-02-01T00:00:00.000Z').toISOString());
});

test('computeLastActivity ignores admin-sent messages, only counts scholar-sent ones', () => {
  const scholar = { firestoreId: 'scholar-1', archivedDate: '2023-01-01T00:00:00.000Z' };
  const messages = [
    { fromUserId: 'admin', createdAt: '2024-06-01T00:00:00.000Z' }, // should be ignored
  ];
  const result = computeLastActivity(scholar, messages);
  assert.equal(result.toISOString(), new Date('2023-01-01T00:00:00.000Z').toISOString());
});

test('computeLastActivity ignores malformed/unparseable timestamps', () => {
  const scholar = {
    archivedDate: 'not-a-date',
    cogSubmissions: [{ uploadedAt: null }],
  };
  assert.equal(computeLastActivity(scholar, []), null);
});

test('isInactiveGraduate is false when there is no activity signal at all', () => {
  assert.equal(isInactiveGraduate({}, [], 730), false);
});

test('isInactiveGraduate is false when last activity is within the threshold', () => {
  const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
  const scholar = { archivedDate: recentDate };
  assert.equal(isInactiveGraduate(scholar, [], 730), false);
});

test('isInactiveGraduate is true once last activity exceeds the threshold', () => {
  const oldDate = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString(); // ~2.2 years ago
  const scholar = { archivedDate: oldDate };
  assert.equal(isInactiveGraduate(scholar, [], 730), true);
});

test('isInactiveGraduate treats a non-positive threshold as "never flag"', () => {
  const oldDate = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString();
  const scholar = { archivedDate: oldDate };
  assert.equal(isInactiveGraduate(scholar, [], 0), false);
  assert.equal(isInactiveGraduate(scholar, [], -5), false);
});
