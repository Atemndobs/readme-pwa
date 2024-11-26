import { create } from 'zustand'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'

interface AudioSegment extends TextSegment {
  id: string
  audio?: HTMLAudioElement
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'
  error?: string
}

interface QueueItem {
  id: string
  text: string
  voice: VoiceId
  segments: AudioSegment[]
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error'
  error?: string
  currentSegment: number
  totalSegments: number
}

interface AudioQueueStore {
  queue: QueueItem[]
  currentIndex: number | null
  isPlaying: boolean
  currentAudio: HTMLAudioElement | null
  add: (text: string, voice: VoiceId) => Promise<void>
  remove: (id: string) => void
  clear: () => void
  play: (id?: string, segmentIndex?: number) => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  setStatus: (id: string, status: QueueItem['status'], error?: string) => void
}

export const useAudioQueue = create<AudioQueueStore>((set, get) => ({
  queue: [],
  currentIndex: null,
  isPlaying: false,
  currentAudio: null,

  add: async (text: string, voice: VoiceId) => {
    const id = Date.now().toString()
    const textSegments = segmentText(text)
    
    const segments: AudioSegment[] = textSegments.map((segment, index) => ({
      ...segment,
      id: `${id}-${index}`,
      status: 'pending'
    }))

    const queueItem: QueueItem = {
      id,
      text,
      voice,
      segments,
      status: 'loading',
      currentSegment: 0,
      totalSegments: segments.length
    }

    set(state => ({
      queue: [...state.queue, queueItem]
    }))

    // Start processing immediately
    try {
      const audioSegments = await convertTextToSpeech(text, voice)
      
      set(state => {
        const itemIndex = state.queue.findIndex(item => item.id === id)
        if (itemIndex === -1) return state

        const updatedQueue = [...state.queue]
        const item = updatedQueue[itemIndex]
        
        item.segments = item.segments.map((segment, index) => {
          const audioBlob = audioSegments[index]?.audio;
          if (!audioBlob) {
            return {
              ...segment,
              status: 'error' as const,
            };
          }
          return {
            ...segment,
            audio: new Audio(URL.createObjectURL(audioBlob)),
            status: 'ready' as const,
          };
        });
        item.status = 'ready'

        return { queue: updatedQueue }
      })

      // Start playing if it's the only item
      const state = get()
      if (state.queue.length === 1) {
        await get().play(id)
      }
    } catch (error) {
      set(state => {
        const itemIndex = state.queue.findIndex(item => item.id === id)
        if (itemIndex === -1) return state

        const updatedQueue = [...state.queue]
        updatedQueue[itemIndex].status = 'error'
        updatedQueue[itemIndex].error = error instanceof Error ? error.message : 'Failed to convert text to speech'

        return { queue: updatedQueue }
      })
    }
  },

  remove: (id: string) => {
    set(state => ({
      queue: state.queue.filter(item => {
        if (item.id === id) {
          // Clean up audio elements
          item.segments.forEach(segment => {
            if (segment.audio) {
              segment.audio.pause()
              segment.audio.src = ''
              segment.audio.load()
            }
          })
          return false
        }
        return true
      })
    }))
  },

  clear: () => {
    set(state => {
      // Clean up all audio elements
      if (state.currentAudio) {
        state.currentAudio.pause()
        state.currentAudio.currentTime = 0
      }
      state.queue.forEach(item => {
        item.segments.forEach(segment => {
          if (segment.audio) {
            segment.audio.pause()
            segment.audio.src = ''
            segment.audio.load()
          }
        })
      })
      return { queue: [], currentIndex: null, isPlaying: false, currentAudio: null }
    })
  },

  next: async () => {
    const state = get()
    if (state.currentIndex === null) return

    const currentItem = state.queue[state.currentIndex]
    if (!currentItem) return

    // Stop current audio
    if (state.currentAudio) {
      state.currentAudio.pause()
      state.currentAudio.currentTime = 0
      set({ currentAudio: null })
    }

    // First try to move to next segment
    if (currentItem.currentSegment < currentItem.segments.length - 1) {
      await get().play(currentItem.id, currentItem.currentSegment + 1)
    } else {
      // If no more segments, try next item
      const nextIndex = state.currentIndex + 1
      if (nextIndex < state.queue.length) {
        await get().play(state.queue[nextIndex].id)
      } else {
        // Just stop playing but keep the queue and current index
        set({ isPlaying: false, currentAudio: null })
      }
    }
  },

  previous: async () => {
    const state = get()
    if (state.currentIndex === null) return

    const currentItem = state.queue[state.currentIndex]
    if (!currentItem) return

    // Stop current audio
    if (state.currentAudio) {
      state.currentAudio.pause()
      state.currentAudio.currentTime = 0
      set({ currentAudio: null })
    }

    // First try to move to previous segment
    if (currentItem.currentSegment > 0) {
      await get().play(currentItem.id, currentItem.currentSegment - 1)
    } else {
      // If at first segment, try previous item
      const prevIndex = state.currentIndex - 1
      if (prevIndex >= 0) {
        const prevItem = state.queue[prevIndex]
        await get().play(prevItem.id, prevItem.segments.length - 1)
      }
    }
  },

  play: async (id?: string, segmentIndex?: number) => {
    const state = get()
    let targetIndex = state.currentIndex

    if (id) {
      targetIndex = state.queue.findIndex(item => item.id === id)
      if (targetIndex === -1) return
    } else if (targetIndex === null && state.queue.length > 0) {
      targetIndex = 0
    }

    if (targetIndex === null) return

    const item = state.queue[targetIndex]
    if (!item) return

    // If segmentIndex is provided, update the current segment
    if (segmentIndex !== undefined) {
      item.currentSegment = Math.min(Math.max(0, segmentIndex), item.totalSegments - 1)
    }

    // Stop any currently playing audio
    if (state.currentAudio) {
      state.currentAudio.pause()
      state.currentAudio.currentTime = 0
    }

    // Update state
    set({ 
      currentIndex: targetIndex, 
      isPlaying: true,
      queue: state.queue.map((qItem, i) => ({
        ...qItem,
        status: i === targetIndex ? 'playing' : qItem.status
      }))
    })

    // Start playing from the current segment
    const segment = item.segments[item.currentSegment]
    if (segment?.audio) {
      try {
        segment.audio.currentTime = 0
        set({ currentAudio: segment.audio })
        await segment.audio.play()

        // Set up event listeners for the current segment
        segment.audio.onended = async () => {
          set({ currentAudio: null })
          // Move to next segment or next item
          if (item.currentSegment < item.segments.length - 1) {
            item.currentSegment++
            await get().play(item.id, item.currentSegment)
          } else {
            // Move to next item
            await get().next()
          }
        }

        // Handle errors
        segment.audio.onerror = () => {
          set({ currentAudio: null })
          set(state => ({
            queue: state.queue.map((qItem, i) => 
              i === targetIndex 
                ? { ...qItem, status: 'error', error: 'Failed to play audio' }
                : qItem
            )
          }))
        }
      } catch (error) {
        console.error('Playback error:', error)
        set({ currentAudio: null })
        set(state => ({
          queue: state.queue.map((qItem, i) => 
            i === targetIndex 
              ? { ...qItem, status: 'error', error: 'Failed to play audio' }
              : qItem
          )
        }))
      }
    }
  },

  pause: () => {
    const state = get()
    if (state.currentIndex === null) return

    const item = state.queue[state.currentIndex]
    if (!item) return

    // Pause current audio
    if (state.currentAudio) {
      state.currentAudio.pause()
      set({ currentAudio: null })
    }

    // Update state
    set({
      isPlaying: false,
      queue: state.queue.map((qItem, i) => ({
        ...qItem,
        status: i === state.currentIndex ? 'paused' : qItem.status
      }))
    })
  },

  setStatus: (id: string, status: QueueItem['status'], error?: string) => {
    set(state => ({
      queue: state.queue.map(item =>
        item.id === id
          ? { ...item, status, ...(error && { error }) }
          : item
      )
    }))
  }
}))
