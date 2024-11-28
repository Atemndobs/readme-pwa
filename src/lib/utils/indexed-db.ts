const DB_NAME = 'readme-audio-db'
const DB_VERSION = 1
export const AUDIO_STORE = 'audio-data'

interface AudioData {
  id: string
  data: ArrayBuffer
  timestamp: number
}

let db: IDBDatabase | null = null

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && window.indexedDB

export async function getDb(): Promise<IDBDatabase> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment')
  }
  
  if (db) return db
  await initDB()
  return db!
}

async function initDB(): Promise<void> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment')
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve()
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' })
      }
    }
  })
}

function dispatchStorageEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('indexeddb-storage-change'));
  }
}

export async function storeAudioData(id: string, data: ArrayBuffer): Promise<void> {
  if (!isBrowser) return

  const database = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIO_STORE], 'readwrite')
    const store = transaction.objectStore(AUDIO_STORE)
    
    const request = store.put({
      id,
      data,
      timestamp: Date.now()
    })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dispatchStorageEvent();
      resolve()
    }
  })
}

export async function getAudioData(id: string): Promise<ArrayBuffer | null> {
  if (!isBrowser) return null

  const database = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIO_STORE], 'readonly')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result as AudioData | undefined
      resolve(result?.data ?? null)
    }
  })
}

export async function removeAudioData(id: string): Promise<void> {
  if (!isBrowser) return

  const database = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIO_STORE], 'readwrite')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dispatchStorageEvent();
      resolve()
    }
  })
}

export async function clearAudioData(): Promise<void> {
  if (!isBrowser) return

  const database = await getDb()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIO_STORE], 'readwrite')
    const store = transaction.objectStore(AUDIO_STORE)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      dispatchStorageEvent();
      resolve()
    }
  })
}

/**
 * Get total size of all audio data stored in IndexedDB
 */
export async function getAudioDataSize(): Promise<number> {
  if (!isBrowser) return 0;

  const database = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([AUDIO_STORE], 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const items = request.result as AudioData[];
      const totalSize = items.reduce((sum, item) => {
        if (item.data instanceof ArrayBuffer) {
          return sum + item.data.byteLength;
        }
        return sum;
      }, 0);
      resolve(totalSize);
    };
  });
}
