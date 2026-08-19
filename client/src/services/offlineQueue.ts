import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { QueuedScan } from '../types';
import { api } from './api';

interface CheckPointDB extends DBSchema {
  scans: {
    key: string;
    value: QueuedScan;
    indexes: { 'by-status': string };
  };
}

const DB_NAME = 'checkpoint_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CheckPointDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CheckPointDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CheckPointDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('scans')) {
          const store = db.createObjectStore('scans', { keyPath: 'client_scan_id' });
          store.createIndex('by-status', 'status');
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineScan(
  token: string,
  stationId: string = 'station-web'
): Promise<QueuedScan> {
  const db = await getDB();
  const client_scan_id = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const item: QueuedScan = {
    client_scan_id,
    token,
    station_id: stationId,
    scanned_at: new Date().toISOString(),
    status: 'pending',
  };

  await db.put('scans', item);
  return item;
}

export async function getPendingScans(): Promise<QueuedScan[]> {
  const db = await getDB();
  return db.getAllFromIndex('scans', 'by-status', 'pending');
}

export async function getAllScans(): Promise<QueuedScan[]> {
  const db = await getDB();
  return db.getAll('scans');
}

export async function clearSyncedScans(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('scans', 'readwrite');
  const index = tx.store.index('by-status');
  let cursor = await index.openCursor('synced');
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function syncOfflineScans(): Promise<{
  syncedCount: number;
  failedCount: number;
  results: any[];
}> {
  const pending = await getPendingScans();
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0, results: [] };
  }

  const db = await getDB();
  const payload = pending.map((s) => ({
    token: s.token,
    client_scan_id: s.client_scan_id,
    station_id: s.station_id,
    scanned_at: s.scanned_at,
  }));

  try {
    const res = await api.post<{ results: Array<{ client_scan_id: string; outcome: string; error?: string }> }>(
      '/api/checkins/sync',
      { scans: payload }
    );

    const tx = db.transaction('scans', 'readwrite');
    let syncedCount = 0;
    let failedCount = 0;

    for (const r of res.results) {
      const existing = await tx.store.get(r.client_scan_id);
      if (existing) {
        if (r.outcome === 'error') {
          existing.status = 'failed';
          existing.error = r.error;
          failedCount++;
        } else {
          existing.status = 'synced';
          existing.outcome = r.outcome;
          syncedCount++;
        }
        await tx.store.put(existing);
      }
    }

    await tx.done;
    return { syncedCount, failedCount, results: res.results };
  } catch (err: any) {
    console.error('[Offline Sync Error]', err);
    return { syncedCount: 0, failedCount: pending.length, results: [] };
  }
}
