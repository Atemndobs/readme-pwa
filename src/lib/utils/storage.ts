import { getAudioDataSize } from './indexed-db';

// IndexedDB typically allows for much larger storage (50% of available disk space)
// Set a reasonable default of 1GB for audio storage
export const STORAGE_QUOTA = 1024 * 1024 * 1024; // 1GB default quota

export interface StorageStats {
  used: number;
  total: number;
  percentage: number;
  items: {
    [key: string]: number;
  };
}

/**
 * Calculate the size of a string in bytes
 * UTF-16 uses 2 bytes per character
 */
function getStringSizeInBytes(str: string): number {
  return new Blob([str]).size;
}

/**
 * Get current storage usage statistics including IndexedDB
 */
export async function getStorageStats(): Promise<StorageStats> {
  try {
    console.log('Starting getStorageStats calculation...');
    const items: { [key: string]: number } = {};
    let localStorageUsed = 0;

    // Calculate localStorage usage by category
    const audioQueueMeta = localStorage.getItem('audio-queue');
    const settings = localStorage.getItem('readme-settings');
    
    console.log('Local storage items:', {
      'audio-queue': audioQueueMeta ? audioQueueMeta.length : 0,
      'readme-settings': settings ? settings.length : 0
    });

    // Audio queue metadata size
    if (audioQueueMeta) {
      const size = getStringSizeInBytes('audio-queue') + getStringSizeInBytes(audioQueueMeta);
      items['audio-queue'] = size;
      localStorageUsed += size;
      console.log('Audio queue metadata size:', { size, localStorageUsed });
    }

    // Settings size
    if (settings) {
      const size = getStringSizeInBytes('readme-settings') + getStringSizeInBytes(settings);
      items['readme-settings'] = size;
      localStorageUsed += size;
      console.log('Settings size:', { size, localStorageUsed });
    }

    // Get audio data size from IndexedDB
    console.log('Getting audio data size from IndexedDB...');
    const audioDataSize = await getAudioDataSize();
    console.log('Audio data size from IndexedDB:', audioDataSize);
    
    // Add audio data size to audio-queue total
    if (items['audio-queue']) {
      items['audio-queue'] += audioDataSize;
    } else {
      items['audio-queue'] = audioDataSize;
    }

    const totalUsed = localStorageUsed + audioDataSize;
    const percentage = Math.min(100, Math.round((totalUsed / STORAGE_QUOTA) * 100)) || 0;

    const stats = {
      used: totalUsed,
      total: STORAGE_QUOTA,
      percentage,
      items
    };

    console.log('Final storage stats:', stats);
    return stats;
  } catch (error) {
    console.error('Error calculating storage stats:', error);
    return {
      used: 0,
      total: STORAGE_QUOTA,
      percentage: 0,
      items: {}
    };
  }
}

export function clearStorage(key?: string) {
  try {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.clear();
    }
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}

export function getStorageKeys(): string[] {
  try {
    const keys = Object.keys(localStorage);
    keys.push('audio-data'); // Add IndexedDB audio storage
    return keys;
  } catch (error) {
    console.error('Error getting storage keys:', error);
    return [];
  }
}

export function getStorageItemSize(key: string): number {
  try {
    const item = localStorage.getItem(key);
    if (!item) return 0;
    return getStringSizeInBytes(key) + getStringSizeInBytes(item);
  } catch (error) {
    console.error('Error getting item size:', error);
    return 0;
  }
}
