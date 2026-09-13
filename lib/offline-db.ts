/**
 * lib/offline-db.ts
 * IndexedDB wrapper for offline POS mode.
 *
 * Stores:
 *  - pending_transactions  — sales queued while offline, synced when back online
 *  - services_cache        — service catalogue cached from last online session
 *  - employees_cache       — employee list
 *  - clients_cache         — client list
 */

const DB_NAME = 'pronto-offline'
const DB_VERSION = 2

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PendingTransaction {
  /** Local UUID assigned at queue time */
  id: string
  business_id: string
  client_id: string | null
  employee_id: string | null
  amount: number
  payment_method: string
  items: Array<{ service_id?: string; item_id?: string; name: string; price: number; qty: number }>
  /** ISO timestamp — generated locally */
  created_at: string
  /** false until successfully synced to Supabase */
  synced: boolean
  /** Local receipt number shown to user (e.g. "OFFLINE-1") */
  local_receipt: string
}

export interface CachedService {
  id: string
  name: string
  price: number
  duration_min: number
  category: string | null
}

export interface CachedEmployee {
  id: string
  name: string
}

export interface CachedClient {
  id: string
  name: string
  phone: string | null
}

export interface CachedProduct {
  id: string
  name: string
  price: number
  stock: number
  unit: string
  category: string | null
}

// ─── Open DB ─────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('pending_transactions')) {
        db.createObjectStore('pending_transactions', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('services_cache')) {
        db.createObjectStore('services_cache', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('employees_cache')) {
        db.createObjectStore('employees_cache', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('clients_cache')) {
        db.createObjectStore('clients_cache', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('products_cache')) {
        db.createObjectStore('products_cache', { keyPath: 'id' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── Pending transactions ─────────────────────────────────────────────────────

let localReceiptCounter = 0

/** Save a transaction to the offline queue. Returns the local UUID. */
export async function queueTransaction(
  tx: Omit<PendingTransaction, 'id' | 'synced' | 'created_at' | 'local_receipt'>
): Promise<PendingTransaction> {
  const db = await openDB()
  localReceiptCounter++
  const record: PendingTransaction = {
    ...tx,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    synced: false,
    local_receipt: `OFFLINE-${localReceiptCounter}`,
  }

  return new Promise((resolve, reject) => {
    const t = db.transaction('pending_transactions', 'readwrite')
    t.objectStore('pending_transactions').add(record)
    t.oncomplete = () => resolve(record)
    t.onerror = () => reject(t.error)
  })
}

/**
 * Get all transactions that have not yet been synced.
 *
 * Filters in JS rather than via an index: IndexedDB index keys must be a
 * number, string, Date, binary, or an Array of those — `synced` is a plain
 * boolean, which is not a valid key type. A `by_synced` index built on it
 * would silently exclude every record (no error thrown), so `getAll()` on
 * that index always returns empty regardless of what's actually queued.
 * The pending queue is a handful of offline sales at most, so a full scan
 * costs nothing here.
 */
export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('pending_transactions', 'readonly')
    const req = t.objectStore('pending_transactions').getAll()
    req.onsuccess = () => resolve((req.result ?? []).filter((tx: PendingTransaction) => !tx.synced))
    req.onerror = () => reject(req.error)
  })
}

/** Mark a queued transaction as successfully synced. */
export async function markTransactionSynced(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('pending_transactions', 'readwrite')
    const store = t.objectStore('pending_transactions')
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record: PendingTransaction = getReq.result
      if (record) store.put({ ...record, synced: true })
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

/** Count of unsynced transactions (shown in the offline banner). */
export async function getPendingCount(): Promise<number> {
  try {
    const pending = await getPendingTransactions()
    return pending.length
  } catch {
    return 0
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

type CacheStore = 'services_cache' | 'employees_cache' | 'clients_cache' | 'products_cache'

/** Replace all records in a cache store. */
export async function cacheData<T extends { id: string }>(
  storeName: CacheStore,
  items: T[]
): Promise<void> {
  if (!items.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readwrite')
    const store = t.objectStore(storeName)
    store.clear()
    items.forEach((item) => store.put(item))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

/** Read all records from a cache store. */
export async function getCachedData<T>(storeName: CacheStore): Promise<T[]> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const t = db.transaction(storeName, 'readonly')
      const req = t.objectStore(storeName).getAll()
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
  } catch {
    return []
  }
}
