'use client'

import { useEffect } from 'react'
import { migrateAudioDataToIndexedDB } from '@/lib/utils/storage-cleanup'

export default function ClientInit() {
  useEffect(() => {
    // Migrate any remaining audio data from localStorage to IndexedDB
    migrateAudioDataToIndexedDB()
  }, [])

  return null
}
