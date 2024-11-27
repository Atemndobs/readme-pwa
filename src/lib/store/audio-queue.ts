import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'

interface AudioSegment extends TextSegment {
  id: string
  audioUrl?: string
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
  isConverting: boolean
  conversionAbortController: AbortController | null
  volume: number
  muted: boolean
  add: (text: string, voice: VoiceId) => Promise<void>
  remove: (id: string) => void
  clear: () => void
  play: (id?: string, segmentIndex?: number) => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  setStatus: (id: string, status: QueueItem['status'], error?: string) => void
  cancelConversion: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
}

type PersistedState = Omit<AudioQueueStore, 
  'currentAudio' | 'isPlaying' | 'isConverting' | 'conversionAbortController' | 'add' | 'remove' | 'clear' | 'play' | 'pause' | 'next' | 'previous' | 'setStatus' | 'cancelConversion' | 'setVolume' | 'toggleMute'
>

export const useAudioQueue = create<AudioQueueStore>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: null,
      isPlaying: false,
      currentAudio: null,
      isConverting: false,
      conversionAbortController: null,
      volume: 1,
      muted: false,

      add: async (text: string, voice: VoiceId) => {
        const id = Date.now().toString()
        const textSegments = segmentText(text)
        const abortController = new AbortController()
        
        set(state => ({ 
          isConverting: true,
          conversionAbortController: abortController,
          queue: [
            ...state.queue,
            {
              id,
              text,
              voice,
              segments: textSegments.map((segment, index) => ({
                ...segment,
                id: `${id}-${index}`,
                status: 'pending',
              })),
              status: 'pending',
              currentSegment: 0,
              totalSegments: textSegments.length,
            },
          ],
        }))

        try {
          const audioSegments = await convertTextToSpeech(text, voice, abortController.signal)
          
          // Check if conversion was cancelled
          if (abortController.signal.aborted) {
            set(state => ({
              isConverting: false,
              conversionAbortController: null,
              queue: state.queue.filter(item => item.id !== id)
            }))
            return
          }

          set(state => {
            const itemIndex = state.queue.findIndex(item => item.id === id)
            if (itemIndex === -1) return state

            const updatedQueue = [...state.queue]
            const item = updatedQueue[itemIndex]
            
            item.segments = item.segments.map((segment, index) => {
              const audioBlob = audioSegments[index]?.audio
              if (!audioBlob) {
                return {
                  ...segment,
                  status: 'error' as const,
                }
              }
              const audioUrl = URL.createObjectURL(audioBlob)
              const audio = new Audio(audioUrl)
              return {
                ...segment,
                audio,
                audioUrl,
                status: 'ready' as const,
              }
            })
            item.status = 'ready'

            return { 
              queue: updatedQueue, 
              isConverting: false,
              conversionAbortController: null
            }
          })

          // Start playing if it's the only item
          const state = get()
          if (state.queue.length === 1) {
            await get().play(id)
          }
        } catch (error) {
          // Only update error state if conversion wasn't cancelled
          if (!abortController.signal.aborted) {
            set(state => {
              const itemIndex = state.queue.findIndex(item => item.id === id)
              if (itemIndex === -1) return state

              const updatedQueue = [...state.queue]
              const item = updatedQueue[itemIndex]
              
              item.status = 'error'
              item.error = error instanceof TTSError ? error.message : 'Failed to convert text to speech'
              
              return { 
                queue: updatedQueue, 
                isConverting: false,
                conversionAbortController: null
              }
            })
          }
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
        const { queue, currentIndex, currentAudio } = get()
        
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }

        if (currentIndex === null) {
          if (queue.length > 0) {
            await get().play(queue[0].id)
          }
          return
        }

        const currentItem = queue[currentIndex]
        
        // If there are more segments in the current item
        if (currentItem && currentItem.currentSegment < currentItem.totalSegments - 1) {
          await get().play(currentItem.id, currentItem.currentSegment + 1)
          return
        }

        // Move to next item
        if (currentIndex < queue.length - 1) {
          await get().play(queue[currentIndex + 1].id)
        } else {
          // End of queue
          set({ 
            isPlaying: false,
            currentAudio: null,
            queue: queue.map((item, index) => 
              index === currentIndex 
                ? { ...item, status: 'ready' }
                : item
            )
          })
        }
      },

      previous: async () => {
        const { queue, currentIndex, currentAudio } = get()
        
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }

        if (currentIndex === null) {
          if (queue.length > 0) {
            await get().play(queue[0].id)
          }
          return
        }

        const currentItem = queue[currentIndex]

        // If we're not at the start of the current item's segments
        if (currentItem && currentItem.currentSegment > 0) {
          await get().play(currentItem.id, currentItem.currentSegment - 1)
          return
        }

        // Move to previous item
        if (currentIndex > 0) {
          const prevItem = queue[currentIndex - 1]
          await get().play(prevItem.id, prevItem.totalSegments - 1)
        }
      },

      play: async (id?: string, segmentIndex?: number) => {
        const { queue, currentIndex, currentAudio, volume, muted } = get()
        
        // Stop current audio if playing
        if (currentAudio) {
          currentAudio.pause()
          currentAudio.currentTime = 0
        }

        // Find the item to play
        let itemIndex = currentIndex
        if (id) {
          itemIndex = queue.findIndex(item => item.id === id)
          if (itemIndex === -1) {
            throw new Error('Item not found')
          }
        } else if (itemIndex === null && queue.length > 0) {
          itemIndex = 0
        }

        if (itemIndex === null || itemIndex >= queue.length) {
          return
        }

        const item = queue[itemIndex]
        const segment = item.segments[segmentIndex ?? item.currentSegment]
        
        if (!segment || !segment.audioUrl) {
          throw new Error('No audio URL available')
        }

        try {
          // Create and configure new audio element
          const audio = new Audio(segment.audioUrl)
          audio.volume = volume
          audio.muted = muted

          // Set up event listeners
          audio.addEventListener('ended', () => {
            get().next()
          })

          // Update state and play
          set({ 
            currentIndex: itemIndex,
            currentAudio: audio,
            isPlaying: true,
            queue: queue.map((item, index) => 
              index === itemIndex 
                ? { ...item, currentSegment: segmentIndex ?? item.currentSegment, status: 'playing' }
                : item
            )
          })

          await audio.play()
        } catch (error) {
          console.error('Playback error:', error)
          set(state => ({
            isPlaying: false,
            queue: state.queue.map((item, index) => 
              index === itemIndex 
                ? { ...item, status: 'error', error: error.message }
                : item
            )
          }))
          throw error
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
      },

      cancelConversion: () => {
        const { conversionAbortController, queue } = get()
        if (conversionAbortController) {
          conversionAbortController.abort()
          set({ 
            isConverting: false, 
            conversionAbortController: null,
            queue: queue.filter(item => item.status !== 'pending')
          })
        }
      },

      setVolume: (volume: number) => {
        set({ volume })
        // Update volume of current audio element if it exists
        const currentAudio = get().currentAudio
        if (currentAudio) {
          currentAudio.volume = volume
        }
      },

      toggleMute: () => {
        set(state => ({ muted: !state.muted }))
        // Update volume of current audio element if it exists
        const currentAudio = get().currentAudio
        if (currentAudio) {
          currentAudio.muted = get().muted
        }
      }
    }),
    {
      name: 'audio-queue',
      version: 1,
      partialize: (state) => ({
        queue: state.queue.map(item => ({
          ...item,
          segments: item.segments.map(segment => ({
            ...segment,
            audio: undefined // Don't persist Audio objects
          }))
        })),
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted
      }),
      onRehydrateStorage: () => (state) => {
        // Reconstruct Audio objects from URLs after rehydration
        if (state?.queue) {
          state.queue.forEach(item => {
            item.segments.forEach(segment => {
              if (segment.audioUrl) {
                segment.audio = new Audio(segment.audioUrl);
              }
            });
          });
        }
      }
    }
  )
)
