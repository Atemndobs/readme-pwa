export const STORAGE_QUOTA = 5 * 1024 * 1024; // 5MB is a common localStorage limit

export interface StorageStats {
  used: number;
  total: number;
  percentage: number;
}

export function getStorageStats(): StorageStats {
  let total = 0;
  Object.keys(localStorage).forEach((key) => {
    const item = localStorage.getItem(key);
    if (item !== null) {
      total += (item.length + key.length) * 2; // UTF-16 uses 2 bytes per char
    }
  });

  return {
    used: total,
    total: STORAGE_QUOTA,
    percentage: Math.round((total / STORAGE_QUOTA) * 100)
  };
}

export function clearStorage(key?: string) {
  if (key) {
    localStorage.removeItem(key);
  } else {
    localStorage.clear();
  }
}

export function getStorageKeys(): string[] {
  return Object.keys(localStorage);
}

export function getStorageItemSize(key: string): number {
  const item = localStorage.getItem(key);
  if (!item) return 0;
  return (item.length + key.length) * 2; // UTF-16 uses 2 bytes per char
}
