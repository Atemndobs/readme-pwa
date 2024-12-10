import { getStorageStats, getStorageKeys, clearStorage, getStorageItemSize } from './storage'
import { useSettings } from '@/lib/store/settings'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { removeAudioData, clearAudioData } from './indexed-db'
import { Settings } from '@/lib/store/settings'
import { Key } from 'lucide-react'

interface StorageItem {
  key: string
  size: number
  timestamp: number
}

// Get all storage items with their metadata
function getStorageItems(): StorageItem[] {
  return getStorageKeys().map(key => {
    const item = localStorage.getItem(key)
    let timestamp = Date.now()
    
    try {
      // Try to get timestamp from stored data
      const data = item ? JSON.parse(item) : null
      if (data?.timestamp) {
        timestamp = data.timestamp
      }
    } catch (error) {
      // If parsing fails, use current time
      console.warn(`Could not parse timestamp for ${key}`)
    }

    return {
      key,
      size: getStorageItemSize(key),
      timestamp
    }
  })
}

// Check if storage needs cleanup based on threshold
export async function needsCleanup(): Promise<boolean> {
  const { storage } = useSettings.getState()
  const stats = await getStorageStats()
  return stats.percentage >= storage.cleanupThreshold
}

// Remove items to get under threshold
async function cleanupBySize(): Promise<void> {
  const { storage } = useSettings.getState()
  const items = getStorageItems()
  const stats = await getStorageStats()
  const targetSize = (storage.cleanupThreshold / 100) * stats.total

  if (stats.used <= targetSize) return

  // Sort items by size, largest first
  items.sort((a, b) => b.size - a.size)

  let currentSize = stats.used
  for (const item of items) {
    if (currentSize <= targetSize) break
    
    // Skip current playing item
    const queue = useAudioQueue.getState().queue
    const isPlaying = queue.some(queueItem => 
      queueItem.status === 'playing' && 
      queueItem.segments.some(segment => segment.id === item.key)
    )
    if (isPlaying) continue

    clearStorage(item.key)
    currentSize -= item.size
  }
}

// Remove items older than retention period
async function cleanupByAge(retentionDays: number): Promise<void> {
  const items = getStorageItems()
  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000)

  for (const item of items) {
    if (item.timestamp < cutoff) {
      // Skip current playing item
      const queue = useAudioQueue.getState().queue
      const isPlaying = queue.some(queueItem => 
        queueItem.status === 'playing' && 
        queueItem.segments.some(segment => segment.id === item.key)
      )
      if (isPlaying) continue

      clearStorage(item.key)
    }
  }
}

// Cleanup audio queue items
async function cleanupAudioQueue(keepCurrentItem: boolean = true): Promise<void> {
  const state = useAudioQueue.getState()
  const currentId = state.queue[state.currentIndex || 0]?.id

  for (const item of state.queue) {
    if (keepCurrentItem && item.id === currentId) continue
    if (item.status === 'playing') continue

    // Remove all segments for this item
    for (const segment of item.segments) {
      if (segment.id) {
        await clearAudioData() // @TODO CHECK THIS
      }
    }
  }
}

// Perform storage cleanup
export async function performCleanup(force: boolean = false): Promise<void> {
  const { storage } = useSettings.getState()
  
  if (force || await needsCleanup()) {
    // First try cleaning up old items
    await cleanupByAge(storage.retentionDays)
    
    // If still needs cleanup, remove audio queue items except current
    if (await needsCleanup()) {
      await cleanupAudioQueue(true)
    }
    
    // If still needs cleanup, remove everything including current item
    if (await needsCleanup()) {
      await cleanupAudioQueue(false)
    }
    
    // If still needs cleanup, remove items to get under threshold
    if (await needsCleanup()) {
      await cleanupBySize()
    }
  }
}

// Move audio data from localStorage to IndexedDB
async function migrateToIndexedDB(): Promise<void> {
  const keys = getStorageKeys()
  for (const key of keys) {
    if (key.includes('audioData')) {
      const audioData = localStorage.getItem(key)
      if (audioData) {
        // Convert base64 to ArrayBuffer
        const binaryString = window.atob(audioData)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // Store in IndexedDB
        await removeAudioData(key) // @TODO CHECK THIS
        // Remove from localStorage
        localStorage.removeItem(key)
      }
    }
  }
}

// Setup automatic cleanup monitoring
export function setupAutoCleanup(): () => void {
  const checkInterval = 5 * 60 * 1000 // Check every 5 minutes
  
  const interval = setInterval(async () => {
    const { storage } = useSettings.getState()
    if (storage.autoCleanup && await needsCleanup()) {
      await performCleanup()
    }
  }, checkInterval)
  
  // Cleanup on storage changes
  const handleStorageChange = async () => {
    if (await needsCleanup()) {
      await performCleanup()
    }
  }

  window.addEventListener('storage', handleStorageChange)

  return () => {
    clearInterval(interval)
    window.removeEventListener('storage', handleStorageChange)
  }
}

export async function migrateAudioDataToIndexedDB() {
  try {
    const audioKeys = Object.keys(localStorage).filter(key => key.includes('audioData'));
    if (audioKeys.length === 0) return;
    
    for (const key of audioKeys) {
      const audioData = localStorage.getItem(key);
      if (audioData) {
        // Convert base64 to ArrayBuffer
        const binaryString = window.atob(audioData)
        const len = binaryString.length
        const bytes = new Uint8Array(len)
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // Store in IndexedDB using our utility function
        await removeAudioData(key) // @TODO CHECK THIS
        // Remove from localStorage
        localStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.error('Error migrating audio data:', error);
  }
}

export async function cleanupStorage(): Promise<void> {
  try {
    // Remove all audio data from IndexedDB
    await clearAudioData()
  } catch (error) {
    console.error('Error cleaning up storage:', error)
  }
}

// Export cleanup functions for use in other modules
export { cleanupByAge, cleanupAudioQueue, cleanupBySize }
