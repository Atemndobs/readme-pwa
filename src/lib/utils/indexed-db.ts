import Dexie from 'dexie';

const DB_NAME = 'readme-audio-db';
const AUDIO_STORE = 'audio-data';

interface AudioData {
  id: string;
  data: ArrayBuffer;
  timestamp: number;
}

// Create a new Dexie instance
const db = new Dexie(DB_NAME);
db.version(1).stores({
  [AUDIO_STORE]: 'id'
});

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && window.indexedDB;

export async function getDb(): Promise<Dexie> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment')
  }
  return db;
}

export async function storeAudioData(id: string, data: ArrayBuffer): Promise<string> {
  if (!isBrowser) {
    throw new Error('IndexedDB is not available in this environment');
  }

  try {
    await db.table<AudioData>(AUDIO_STORE).put({ id, data, timestamp: Date.now() });
    dispatchStorageEvent();
    return id;
  } catch (error) {
    console.error('Error storing audio data:', error);
    throw new Error('Failed to store audio data');
  }
}

export async function getAudioData(id: string): Promise<ArrayBuffer | null> {
  if (!isBrowser) return null;

  const audioData = await db.table<AudioData>(AUDIO_STORE).get(id);
  return audioData ? audioData.data : null;
}

export async function removeAudioData(id: string): Promise<void> {
  if (!isBrowser) return;

  await db.table<AudioData>(AUDIO_STORE).delete(id);
  dispatchStorageEvent();
}

export async function clearAudioData(): Promise<void> {
  if (!isBrowser) return;

  await db.table<AudioData>(AUDIO_STORE).clear();
  dispatchStorageEvent();
}

/**
 * Get total size of all audio data stored in IndexedDB
 */
export async function getAudioDataSize(): Promise<number> {
  if (!isBrowser) return 0;

  const audioDatas = await db.table<AudioData>(AUDIO_STORE).toArray();
  const totalSize = audioDatas.reduce((sum, audioData) => {
    if (audioData.data instanceof ArrayBuffer) {
      return sum + audioData.data.byteLength;
    }
    return sum;
  }, 0);
  return totalSize;
}

function dispatchStorageEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('indexeddb-storage-change'));
  }
}

function generateId() {
  return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
