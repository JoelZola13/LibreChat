/**
 * IndexedDB utility for offline storage.
 * Stores courses, lessons, and progress for offline access.
 */

const DB_NAME = 'streetvoices-academy';
const DB_VERSION = 1;

interface DBStores {
  courses: IDBObjectStore;
  modules: IDBObjectStore;
  lessons: IDBObjectStore;
  progress: IDBObjectStore;
  pendingSync: IDBObjectStore;
}

// Database schema
const STORES = {
  courses: { keyPath: 'id', indexes: ['slug', 'category'] },
  modules: { keyPath: 'id', indexes: ['course_id', 'order_index'] },
  lessons: { keyPath: 'id', indexes: ['module_id', 'course_id', 'order_index'] },
  progress: { keyPath: 'id', indexes: ['user_id', 'lesson_id', 'course_id'] },
  pendingSync: { keyPath: 'id', indexes: ['type', 'timestamp'] },
};

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database.
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores
      Object.entries(STORES).forEach(([name, config]) => {
        if (!database.objectStoreNames.contains(name)) {
          const store = database.createObjectStore(name, { keyPath: config.keyPath });
          config.indexes.forEach((indexName) => {
            store.createIndex(indexName, indexName, { unique: false });
          });
        }
      });
    };
  });
}

/**
 * Get a record from a store.
 */
export async function getRecord<T>(storeName: string, key: string): Promise<T | null> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all records from a store.
 */
export async function getAllRecords<T>(storeName: string): Promise<T[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get records by index.
 */
export async function getByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a record to a store.
 */
export async function saveRecord<T>(storeName: string, record: T): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save multiple records to a store.
 */
export async function saveRecords<T>(storeName: string, records: T[]): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);

    records.forEach((record) => {
      store.put(record);
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Delete a record from a store.
 */
export async function deleteRecord(storeName: string, key: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records from a store.
 */
export async function clearStore(storeName: string): Promise<void> {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add a pending sync item.
 */
export async function addPendingSync(
  type: string,
  data: Record<string, unknown>
): Promise<string> {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const record = {
    id,
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
  };

  await saveRecord('pendingSync', record);
  return id;
}

/**
 * Get all pending sync items.
 */
export async function getPendingSync(): Promise<Array<{
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}>> {
  return getAllRecords('pendingSync');
}

/**
 * Remove a pending sync item after successful sync.
 */
export async function removePendingSync(id: string): Promise<void> {
  await deleteRecord('pendingSync', id);
}

/**
 * Check if running in offline mode.
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Listen for online/offline events.
 */
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
