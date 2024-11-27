import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'

interface AudioSegment extends TextSegment {
  id: string
  audioUrl?: string
  audio?: HTMLAudioElement
  audioData?: string  // Base64 encoded audio data
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'cancelled'
  error?: string
}

interface QueueItem {
  id: string
  text: string
  voice: VoiceId
  segments: AudioSegment[]
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'partial' | 'converting'
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
  rehydrateAudio: () => void
  resumeConversion: (id: string, voice: VoiceId) => Promise<void>
}

type PersistedState = Omit<AudioQueueStore, 
  'currentAudio' | 'isPlaying' | 'isConverting' | 'conversionAbortController' | 'add' | 'remove' | 'clear' | 'play' | 'pause' | 'next' | 'previous' | 'setStatus' | 'cancelConversion' | 'setVolume' | 'toggleMute' | 'rehydrateAudio' | 'resumeConversion'
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
          queue: [
            ...state.queue,
            {
              id,
              segments: textSegments.map((segment, index) => ({
                ...segment,
                id: `${id}-${index}`,
                status: 'pending',
                audioUrl: null,
                audio: null
              })),
              currentSegment: 0,
              totalSegments: textSegments.length,
              status: 'pending',
              error: null
            }
          ],
          isConverting: true,
          conversionAbortController: abortController
        }))

        let firstSegmentConverted = false

        try {
          // Convert segments one by one
          for (let i = 0; i < textSegments.length; i++) {
            const segment = textSegments[i]
            
            try {
              // Convert current segment
              const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: segment.text, voice }),
                signal: abortController.signal
              })

              if (!response.ok) {
                throw new Error('Failed to convert text to speech')
              }

              const audioBlob = await response.blob()
              // Convert blob to base64 for storage
              const reader = new FileReader()
              const audioData = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(audioBlob)
              })
              
              const audioUrl = URL.createObjectURL(audioBlob)
              const audio = new Audio(audioUrl)

              // Update segment with audio and audioData
              set(state => ({
                queue: state.queue.map(item =>
                  item.id === id
                    ? {
                        ...item,
                        segments: item.segments.map((seg, segIndex) =>
                          segIndex === i
                            ? {
                                ...seg,
                                status: 'ready',
                                audioUrl,
                                audio,
                                audioData
                              }
                            : seg
                        ),
                        status: i === textSegments.length - 1 ? 'ready' : 'converting'
                      }
                    : item
                )
              }))

              // Start playing after first segment is ready
              if (!firstSegmentConverted) {
                firstSegmentConverted = true
                const state = get()
                if (state.currentIndex === null) {
                  // Only auto-play if nothing else is playing
                  await get().play(id)
                }
              }

            } catch (error) {
              if (error.name === 'AbortError') {
                throw error // Re-throw abort errors
              }
              
              console.error(`Error converting segment ${i}:`, error)
              // Mark the failed segment but continue with others
              set(state => ({
                queue: state.queue.map(item =>
                  item.id === id
                    ? {
                        ...item,
                        segments: item.segments.map((seg, segIndex) =>
                          segIndex === i
                            ? {
                                ...seg,
                                status: 'error',
                                error: error.message
                              }
                            : seg
                        )
                      }
                    : item
                )
              }))
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            // Conversion was cancelled
            set(state => ({
              isConverting: false,
              conversionAbortController: null,
              queue: state.queue.filter(item => item.status !== 'pending')
            }))
            return
          }

          // Handle other errors
          set(state => ({
            isConverting: false,
            conversionAbortController: null,
            queue: state.queue.map(item =>
              item.id === id
                ? { ...item, status: 'error', error: error.message }
                : item
            )
          }))
          throw error
        }

        // All segments converted successfully
        set(state => ({
          isConverting: false,
          conversionAbortController: null
        }))
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
        console.log('Playing audio...', { id, segmentIndex })
        const { queue, currentIndex, volume, muted } = get()
        
        // Stop current audio if any
        const currentAudio = get().currentAudio
        if (currentAudio) {
          console.log('Stopping current audio')
          currentAudio.pause()
          currentAudio.currentTime = 0
        }

        // Find the item to play
        let itemIndex = currentIndex
        if (id) {
          itemIndex = queue.findIndex(item => item.id === id)
          if (itemIndex === -1) {
            console.error('Item not found:', id)
            return
          }
        } else if (itemIndex === null && queue.length > 0) {
          itemIndex = 0
        }

        if (itemIndex === null || itemIndex >= queue.length) {
          return
        }

        const item = queue[itemIndex]
        const segment = item.segments[segmentIndex ?? item.currentSegment]
        
        if (!segment || !segment.audioData) {
          console.error('No audio data available for segment:', segment)
          throw new Error('No audio data available')
        }

        try {
          console.log('Creating audio from stored data:', {
            segmentId: segment.id,
            hasAudioData: !!segment.audioData,
            dataPreview: segment.audioData?.substring(0, 100) + '...'
          })
          
          // Create new blob URL from stored base64 data
          const byteString = atob(segment.audioData.split(',')[1])
          const mimeType = segment.audioData.split(',')[0].split(':')[1].split(';')[0]
          console.log('Audio MIME type:', mimeType)
          
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
          }
          const blob = new Blob([ab], { type: mimeType })
          const audioUrl = URL.createObjectURL(blob)
          console.log('Created new blob URL:', audioUrl)
          
          const audio = new Audio(audioUrl)
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
        const { conversionAbortController, queue, currentIndex } = get()
        if (conversionAbortController) {
          conversionAbortController.abort()
          
          // Instead of removing the item, keep converted segments
          set(state => {
            const updatedQueue = state.queue.map(item => {
              if (item.status === 'pending' || item.status === 'converting') {
                return {
                  ...item,
                  status: 'partial', // New status for partially converted items
                  segments: item.segments.map(segment => ({
                    ...segment,
                    status: segment.status === 'ready' ? 'ready' : 'cancelled'
                  }))
                }
              }
              return item
            })
            
            return {
              isConverting: false,
              conversionAbortController: null,
              queue: updatedQueue
            }
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
      },

      rehydrateAudio: () => {
        console.log('Rehydrating audio from storage...')
        set(state => {
          const updatedQueue = state.queue.map(item => ({
            ...item,
            segments: item.segments.map(segment => {
              if (segment.audioData) {
                console.log(`Rehydrating segment ${segment.id}:`, {
                  hasAudioData: true,
                  dataLength: segment.audioData.length,
                  preview: segment.audioData.substring(0, 100) + '...'
                })
                
                // Create new blob URL from stored base64 data
                const byteString = atob(segment.audioData.split(',')[1])
                const mimeType = segment.audioData.split(',')[0].split(':')[1].split(';')[0]
                console.log('Audio MIME type:', mimeType)
                
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i)
                }
                const blob = new Blob([ab], { type: mimeType })
                const audioUrl = URL.createObjectURL(blob)
                console.log('Created new blob URL:', audioUrl)
                
                return {
                  ...segment,
                  audioUrl,
                  audio: new Audio(audioUrl)
                }
              }
              console.log(`Segment ${segment.id} has no audio data`)
              return segment
            })
          }))
          console.log('Rehydration complete. Queue:', updatedQueue)
          return { queue: updatedQueue }
        })
      },

      resumeConversion: async (id: string, voice: VoiceId) => {
        const { queue } = get()
        const item = queue.find(item => item.id === id)
        if (!item) return

        const abortController = new AbortController()
        
        set({ 
          isConverting: true,
          conversionAbortController: abortController
        })

        try {
          // Convert remaining segments
          for (let i = 0; i < item.segments.length; i++) {
            const segment = item.segments[i]
            
            // Skip already converted segments
            if (segment.status === 'ready') continue

            try {
              const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: segment.text, voice }),
                signal: abortController.signal
              })

              if (!response.ok) {
                throw new Error('Failed to convert text to speech')
              }

              const audioBlob = await response.blob()
              // Convert blob to base64 for storage
              const reader = new FileReader()
              const audioData = await new Promise<string>((resolve) => {
                reader.onloadend = () => resolve(reader.result as string)
                reader.readAsDataURL(audioBlob)
              })
              
              const audioUrl = URL.createObjectURL(audioBlob)
              const audio = new Audio(audioUrl)

              // Update segment with audio and audioData
              set(state => ({
                queue: state.queue.map(qItem =>
                  qItem.id === id
                    ? {
                        ...qItem,
                        segments: qItem.segments.map((seg, segIndex) =>
                          segIndex === i
                            ? {
                                ...seg,
                                status: 'ready',
                                audioUrl,
                                audio,
                                audioData
                              }
                            : seg
                        ),
                        status: i === item.segments.length - 1 ? 'ready' : 'converting'
                      }
                    : qItem
                )
              }))

            } catch (error) {
              if (error.name === 'AbortError') throw error
              
              console.error(`Error converting segment ${i}:`, error)
              // Mark the failed segment but continue with others
              set(state => ({
                queue: state.queue.map(qItem =>
                  qItem.id === id
                    ? {
                        ...qItem,
                        segments: qItem.segments.map((seg, segIndex) =>
                          segIndex === i
                            ? {
                                ...seg,
                                status: 'error',
                                error: error.message
                              }
                            : seg
                        )
                      }
                    : qItem
                )
              }))
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            // Handle cancellation
            set(state => ({
              isConverting: false,
              conversionAbortController: null,
              queue: state.queue.map(qItem =>
                qItem.id === id
                  ? {
                      ...qItem,
                      status: 'partial',
                      segments: qItem.segments.map(seg => ({
                        ...seg,
                        status: seg.status === 'ready' ? 'ready' : 'cancelled'
                      }))
                    }
                  : qItem
              )
            }))
            return
          }

          // Handle other errors
          set(state => ({
            isConverting: false,
            conversionAbortController: null,
            queue: state.queue.map(qItem =>
              qItem.id === id
                ? { ...qItem, status: 'error', error: error.message }
                : qItem
            )
          }))
          throw error
        }

        // All remaining segments converted successfully
        set(state => ({
          isConverting: false,
          conversionAbortController: null,
          queue: state.queue.map(qItem =>
            qItem.id === id
              ? { ...qItem, status: 'ready' }
              : qItem
          )
        }))
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
            audio: undefined, // Don't persist Audio objects
            audioUrl: undefined, // Don't persist URLs
            // Keep audioData for rehydration
          }))
        })),
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recreate Audio objects from stored URLs
          state.rehydrateAudio()
        }
      }
    }
  )
)
