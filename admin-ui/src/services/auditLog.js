// Records WHO changed a record and WHEN for the Audit Trail.
//
// Entries are written to Firestore `audit_logs` (readable now that the audit_logs
// read rule is deployed). The actor comes from the app-level session since this
// build authenticates to Firebase anonymously.
import { doc, setDoc, collection, query, orderBy, limit as fbLimit, getDocs } from 'firebase/firestore';
import { initializeFirebase } from './firebase';
import { getUsername, getRole } from '../utils/auth';

const LEGACY_LOCAL_KEY = 'ced-audit-logs';

// Remove the old per-browser mirror from previous builds so stale entries can't
// linger after the Firestore audit_logs collection is cleared.
try { localStorage.removeItem(LEGACY_LOCAL_KEY); } catch { /* ignore */ }

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function logAudit({ action, collection: targetCollection, documentId, details } = {}) {
  const id = makeId();
  const now = new Date().toISOString();
  const entry = {
    action: action || 'UPDATE',
    collection: targetCollection || null,
    documentId: documentId || null,
    details: { message: details || '' },
    userId: getUsername(),
    userEmail: getUsername(),
    userRole: getRole(),
    timestamp: now,
    createdAt: now,
  };

  try {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return;
    await setDoc(doc(db, 'audit_logs', id), entry);
  } catch (err) {
    console.warn('Audit log write failed:', err?.message);
  }
}

// Per-scholar history view (Scholars.jsx Records) — reuses the exact same
// query AuditLogs.jsx already runs (order by timestamp, capped), then
// filters client-side by documentId. Deliberately NOT a Firestore `where()`
// clause: logAudit calls write whichever identifier (firestoreId/scholarId/
// numeric id) was available at the time, so a single query can't reliably
// match "any of these" server-side without a composite index — filtering
// client-side avoids needing one.
export async function fetchAuditLogsForDocument(documentIds, { limit: max = 300 } = {}) {
  const ids = new Set((Array.isArray(documentIds) ? documentIds : [documentIds]).filter(Boolean).map(String));
  if (ids.size === 0) return [];

  try {
    const { db, isReady } = initializeFirebase();
    if (!isReady || !db) return [];
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), fbLimit(max));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((entry) => ids.has(String(entry.documentId)));
  } catch (err) {
    console.warn('Audit log fetch failed:', err?.message);
    return [];
  }
}
