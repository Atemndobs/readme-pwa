import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'

type AudioSegmentStatus = 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'cancelled'
type QueueItemStatus = 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'partial' | 'converting'

interface AudioSegment extends TextSegment {
  id: string
  audioUrl: string | null
  audio: HTMLAudioElement | null
  audioData?: string  // Base64 encoded audio data
  status: AudioSegmentStatus
  error?: string
}

interface QueueItem {
  id: string
  text: string
  voice: VoiceId
  source?: string  // Source URL or title
  segments: AudioSegment[]
  status: QueueItemStatus
  error: string | null
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
  currentTime: number
  duration: number
  add: (text: string, voice: VoiceId, source?: string) => Promise<void>
  remove: (id: string) => void
  clear: () => void
  play: (id?: string, segmentIndex?: number) => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  setStatus: (id: string, status: QueueItemStatus, error?: string) => void
  cancelConversion: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  rehydrateAudio: () => void
  resumeConversion: (id: string, voice: VoiceId) => Promise<void>
}

interface PersistedState {
  queue: QueueItem[];
  currentIndex: number | null;
  volume: number;
  muted: boolean;
}

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
      currentTime: 0,
      duration: 0,

      add: async (text: string, voice: VoiceId, source?: string) => {
        // Don't add if already converting
        if (get().isConverting) {
          throw new Error('Already converting text to speech')
        }

        const id = Math.random().toString(36).substring(7)
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
              source,
              segments: textSegments.map(seg => ({
                ...seg,
                id: Math.random().toString(36).substring(7),
                status: 'pending',
                audioUrl: null,
                audio: null,
              })),
              status: 'converting',
              error: null,
              currentSegment: 0,
              totalSegments: textSegments.length
            }
          ]
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
              
              console.log('Segment converted:', {
                audioDataLength: audioData.length
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
              if ((error as { name: string }).name === 'AbortError') {
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
                                error: (error as Error).message || 'Unknown error'
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
          if ((error as { name: string }).name === 'AbortError') {
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
                ? { ...item, status: 'error' as const, error: (error as Error).message || 'Unknown error' }
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
        const state = get()
        if (state.currentAudio) {
          state.currentAudio.pause()
          state.currentAudio.src = ''
          state.currentAudio.load()
        }
        set({
          queue: [],
          currentIndex: null,
          isPlaying: false,
          currentAudio: null,
          currentTime: 0,
          duration: 0
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
        const state = get()
        let targetId = id
        let targetSegmentIndex = segmentIndex

        if (!targetId && state.currentIndex !== null) {
          const currentItem = state.queue[state.currentIndex]
          targetId = currentItem.id
          targetSegmentIndex = currentItem.currentSegment
        }

        // If no target specified and no current item, play first item
        if (!targetId && state.queue.length > 0) {
          targetId = state.queue[0].id
          targetSegmentIndex = 0
        }

        if (!targetId) return

        const itemIndex = state.queue.findIndex(item => item.id === targetId)
        if (itemIndex === -1) return

        const item = state.queue[itemIndex]
        
        // If segment index not specified, use current segment or 0
        if (targetSegmentIndex === undefined) {
          targetSegmentIndex = item.currentSegment
        }

        const segment = item.segments[targetSegmentIndex]
        if (!segment || !segment.audio) return

        // Clean up current audio
        if (state.currentAudio) {
          state.currentAudio.pause()
          state.currentAudio.src = ''
          state.currentAudio.load()
        }

        // Create new handlers
        let currentTimeUpdateHandler: ((e: Event) => void) | null = null;
        let currentEndedHandler: ((e: Event) => void) | null = null;

        currentTimeUpdateHandler = () => {
          if (segment.audio) {
            set({ 
              currentTime: segment.audio.currentTime,
              duration: segment.audio.duration
            })
          }
        };

        currentEndedHandler = async () => {
          // Clean up current audio
          if (state.currentAudio) {
            state.currentAudio.pause()
            state.currentAudio.src = ''
            state.currentAudio.load()
          }
          
          // Move to next segment or item
          const nextSegmentIndex = targetSegmentIndex + 1
          if (nextSegmentIndex < item.segments.length) {
            // Play next segment
            await get().play(targetId, nextSegmentIndex)
          } else {
            // Move to next item
            await get().next()
          }
        };

        // Add event listeners
        segment.audio.addEventListener('timeupdate', currentTimeUpdateHandler)
        segment.audio.addEventListener('ended', currentEndedHandler)

        // Start playback
        try {
          await segment.audio.play()
          set(state => ({
            currentIndex: itemIndex,
            isPlaying: true,
            currentAudio: segment.audio,
            queue: state.queue.map((item, index) => 
              index === itemIndex
                ? { 
                    ...item, 
                    status: 'playing',
                    currentSegment: targetSegmentIndex 
                  }
                : item
            )
          }))
        } catch (error) {
          console.error('Playback error:', error)
          // Clean up current audio
          if (state.currentAudio) {
            state.currentAudio.pause()
            state.currentAudio.src = ''
            state.currentAudio.load()
          }
          throw error
        }
      },

      pause: () => {
        const state = get()
        if (state.currentAudio) {
          state.currentAudio.pause()
        }
        set(state => ({
          isPlaying: false,
          queue: state.queue.map((item, index) => 
            index === state.currentIndex
              ? { ...item, status: 'paused' }
              : item
          )
        }))
      },

      setStatus: (id: string, status: QueueItemStatus, error?: string) => {
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
                  status: 'cancelled' as QueueItemStatus,
                  segments: item.segments.map(seg => ({
                    ...seg,
                    status: (seg.status === 'ready' ? 'ready' : 'cancelled') as AudioSegmentStatus
                  }))
                } as QueueItem
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
            status: 'ready' as QueueItemStatus,
            segments: item.segments.map(segment => {
              console.log('Processing segment:', segment.id, 'with audioData:', !!segment.audioData)
              if (segment.audioData) {
                const byteString = atob(segment.audioData.split(',')[1])
                const mimeType = segment.audioData.split(',')[0].split(':')[1].split(';')[0]
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i)
                }
                const blob = new Blob([ab], { type: mimeType })
                const audioUrl = URL.createObjectURL(blob)
                const audio = new Audio(audioUrl)
                console.log('Rehydrated audio for segment:', segment.id)
                return {
                  ...segment,
                  status: 'ready' as AudioSegmentStatus,
                  audioUrl,
                  audio
                }
              }
              console.warn('No audioData found for segment:', segment.id)
              return segment
            })
          }))
          console.log('Queue rehydrated:', updatedQueue)
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
              
              console.log('Segment converted:', {
                audioDataLength: audioData.length
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
              if ((error as { name: string }).name === 'AbortError') throw error
              
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
                                status: 'error' as const,
                                error: (error as Error).message || 'Unknown error'
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
          if ((error as { name: string }).name === 'AbortError') {
            // Handle cancellation
            set(state => ({
              isConverting: false,
              conversionAbortController: null,
              queue: state.queue.map(qItem =>
                qItem.id === id
                  ? {
                      ...qItem,
                      status: 'partial' as QueueItemStatus,
                      segments: qItem.segments.map(seg => ({
                        ...seg,
                        status: (seg.status === 'ready' ? 'ready' : 'cancelled') as AudioSegmentStatus
                      }))
                    } as QueueItem
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
                ? { ...qItem, status: 'error' as const, error: (error as Error).message || 'Unknown error' }
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
            audio: null,
            audioUrl: null
          }))
        })),
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted
      })
    }
  )
)
