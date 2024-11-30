import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'
import { storeAudioData, getAudioData, removeAudioData, clearAudioData } from '../utils/indexed-db'
import { isIOSSafari } from '@/lib/utils/device';
import { handleIOSAudioInit, getUserInteraction } from '@/lib/utils/ios-audio';

type AudioSegmentStatus = 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'cancelled'
type QueueItemStatus = 'pending' | 'loading' | 'ready' | 'playing' | 'paused' | 'error' | 'partial' | 'converting'

interface AudioSegment extends TextSegment {
  id: string
  audioUrl: string | null
  audio: HTMLAudioElement | null
  status: AudioSegmentStatus
  error?: string
}

interface QueueItem {
  id: string
  text: string
  voice: VoiceId
  source?: string  // Source URL or title
  imageUrl?: string  // URL for the item's image
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
  requiresUserInteraction: boolean
  add: (text: string, voice: VoiceId, source?: string, imageUrl?: string) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: () => Promise<void>
  play: (id?: string, segmentIndex?: number) => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  setStatus: (id: string, status: QueueItemStatus, error?: string) => void
  cancelConversion: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  rehydrateAudio: () => Promise<void>
  resumeConversion: (id: string, voice: VoiceId) => Promise<void>
}

interface PersistedState {
  queue: QueueItem[];
  currentIndex: number | null;
  volume: number;
  muted: boolean;
}

function generateId() {
  return Math.random().toString(36).substring(7)
}

let audioContext: AudioContext | null = null;

const initializeAudioContext = () => {
  if (!audioContext) {
    // Create new audio context with iOS compatible options
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 44100
    });
  }
  
  // Resume audio context if it's suspended (required for iOS)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  return audioContext;
};

const createAudioElement = () => {
  const audio = new Audio();
  
  // iOS Safari specific setup
  if (isIOSSafari()) {
    audio.preload = 'none'; // Prevent automatic loading
    audio.autoplay = false; // Explicitly disable autoplay
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
  } else {
    audio.preload = 'auto';
  }
  
  return audio;
};

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
      requiresUserInteraction: false,

      add: async (text: string, voice: VoiceId, source?: string, imageUrl?: string) => {
        console.log('Adding new audio item:', { text, voice, source, imageUrl })
        
        const state = get()
        if (state.isConverting) {
          console.warn('Already converting text to speech')
          return
        }

        const id = generateId()
        const segments = segmentText(text)
        const totalSegments = segments.length

        console.log('Created segments:', { id, totalSegments, segments })

        // Add item to queue immediately
        set(state => ({
          queue: [
            ...state.queue,
            {
              id,
              text,
              voice,
              source,
              imageUrl,
              segments: segments.map((segment, index) => ({
                ...segment,
                id: `${id}-${index}`,
                audioUrl: null,
                audio: null,
                status: 'pending'
              })),
              status: 'converting',
              error: null,
              currentSegment: 0,
              totalSegments
            }
          ],
          isConverting: true,
          conversionAbortController: new AbortController()
        }))

        try {
          // Convert segments one by one
          for (let i = 0; i < segments.length; i++) {
            console.log(`Converting segment ${i + 1}/${segments.length}`)
            
            const segmentId = `${id}-${i}`
            const response = await fetch('/api/tts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: segments[i].text,
                voice,
              }),
              signal: get().conversionAbortController?.signal,
            })

            if (!response.ok) {
              throw new Error(`Failed to convert text: ${response.statusText}`)
            }

            // Get audio data as ArrayBuffer
            const audioData = await response.arrayBuffer()
            console.log(`Received audio data for segment ${i + 1}, length: ${audioData.byteLength}`)
            
            // Store audio data in IndexedDB
            await storeAudioData(segmentId, audioData)
            console.log(`Stored audio data in IndexedDB for segment ${i + 1}`)
            
            // Create audio element and set up event listeners before setting src
            const audio = createAudioElement()
            
            // Create blob from ArrayBuffer
            try {
              const blob = new Blob([audioData], { type: 'audio/wav' })
              const url = URL.createObjectURL(blob)
              
              // iOS Safari requires user interaction before playing audio
              const playPromise = () => {
                return audio.play().catch(error => {
                  if (error.name === 'NotAllowedError') {
                    console.log('Playback requires user interaction first')
                    // We'll handle this in the UI layer
                    set({ requiresUserInteraction: true })
                  }
                  throw error
                })
              }
              
              audio.src = url
              await audio.load() // Explicitly load the audio
              
              console.log(`Audio src set and loading started for segment ${i + 1}`, {
                blobSize: blob.size,
                blobType: blob.type
              })
            } catch (error) {
              console.error(`Error loading audio for segment ${i + 1}:`, error)
              throw new Error(`Failed to load audio for segment ${i + 1}: ${error}`)
            }
            
            // Update segment status
            set(state => {
              const updatedItem = state.queue.find(item => item.id === id)
              if (!updatedItem) return state

              // Count ready segments
              const readySegments = updatedItem.segments.reduce((count, segment, index) => {
                return count + (index <= i && segment.status === 'ready' ? 1 : 0)
              }, 0)

              console.log('Segment conversion status:', {
                currentSegment: i,
                totalSegments: segments.length,
                readySegments,
                allSegmentsReady: readySegments === segments.length
              })

              return {
                queue: state.queue.map(item =>
                  item.id === id
                    ? {
                        ...item,
                        segments: item.segments.map((segment, index) =>
                          index === i
                            ? {
                                ...segment,
                                audio,
                                status: 'ready'
                              }
                            : segment
                        ),
                        // Set status to ready only when all segments are converted
                        status: readySegments === segments.length ? 'ready' : 'partial',
                        error: null
                      }
                    : item
                )
              }
            })

            // If this is the first segment and no other items are playing, start playback (except on iOS)
            if (i === 0 && !get().isPlaying && get().currentIndex === null && !isIOSSafari()) {
              console.log('Starting playback of first segment')
              await get().play(id, 0)
            } else if (i === 0 && isIOSSafari()) {
              console.log('On iOS Safari - waiting for user interaction before playing')
              set({ requiresUserInteraction: true })
            }
          }

          console.log('Finished converting all segments')
          
          // Ensure final status is set correctly
          set(state => {
            const item = state.queue.find(item => item.id === id)
            if (!item) return state

            const allSegmentsReady = item.segments.every(segment => segment.status === 'ready')
            console.log('Final conversion status:', {
              id,
              allSegmentsReady,
              segmentStatuses: item.segments.map(s => s.status)
            })

            return {
              queue: state.queue.map(qItem =>
                qItem.id === id
                  ? {
                      ...qItem,
                      status: allSegmentsReady ? 'ready' : 'partial'
                    }
                  : qItem
              )
            }
          })
        } catch (error) {
          console.error('Conversion error:', error)
          set(state => ({
            queue: state.queue.map(item =>
              item.id === id
                ? {
                    ...item,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                  }
                : item
            )
          }))
        } finally {
          set({ isConverting: false, conversionAbortController: null })
        }
      },

      remove: async (id: string) => {
        const state = get()
        const item = state.queue.find(item => item.id === id)
        
        if (item) {
          // Remove audio data from IndexedDB
          await Promise.all(item.segments.map(segment => 
            removeAudioData(segment.id)
          ))
        }
        
        set(state => ({
          queue: state.queue.filter(item => item.id !== id),
          currentIndex:
            state.currentIndex !== null
              ? state.queue[state.currentIndex]?.id === id
                ? null
                : state.currentIndex > state.queue.findIndex(item => item.id === id)
                ? state.currentIndex - 1
                : state.currentIndex
              : null
        }))
      },

      clear: async () => {
        // Clear all audio data from IndexedDB
        await clearAudioData()
        
        set({
          queue: [],
          currentIndex: null,
          currentAudio: null,
          isPlaying: false,
          isConverting: false,
          conversionAbortController: null,
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
            await get().play(queue[0].id, 0)
          }
          return
        }

        const currentItem = queue[currentIndex]
        
        // If there are more segments in the current item
        if (currentItem && currentItem.currentSegment < currentItem.totalSegments - 1) {
          // Update currentSegment before playing next
          set(state => ({
            queue: state.queue.map((item, idx) => 
              idx === currentIndex 
                ? { ...item, currentSegment: item.currentSegment + 1 }
                : item
            )
          }))
          await get().play(currentItem.id, currentItem.currentSegment + 1)
          return
        }

        // Move to next item
        if (currentIndex < queue.length - 1) {
          // Reset current item's segment and update next item
          set(state => ({
            queue: state.queue.map((item, idx) => 
              idx === currentIndex 
                ? { ...item, currentSegment: 0 }
                : idx === currentIndex + 1
                  ? { ...item, currentSegment: 0 }
                  : item
            )
          }))
          await get().play(queue[currentIndex + 1].id, 0)
        } else {
          // End of queue
          set({ 
            isPlaying: false,
            currentAudio: null,
            queue: queue.map((item, index) => 
              index === currentIndex 
                ? { ...item, currentSegment: 0, status: 'ready' }
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
            await get().play(queue[0].id, 0)
          }
          return
        }

        const currentItem = queue[currentIndex]

        // If we're not at the start of the current item's segments
        if (currentItem && currentItem.currentSegment > 0) {
          // Update currentSegment before playing previous
          set(state => ({
            queue: state.queue.map((item, idx) => 
              idx === currentIndex 
                ? { ...item, currentSegment: item.currentSegment - 1 }
                : item
            )
          }))
          await get().play(currentItem.id, currentItem.currentSegment - 1)
          return
        }

        // Move to previous item
        if (currentIndex > 0) {
          const prevItem = queue[currentIndex - 1]
          // Update current and previous items' segments
          set(state => ({
            queue: state.queue.map((item, idx) => 
              idx === currentIndex 
                ? { ...item, currentSegment: 0 }
                : idx === currentIndex - 1
                  ? { ...item, currentSegment: item.totalSegments - 1 }
                  : item
            )
          }))
          await get().play(prevItem.id, prevItem.totalSegments - 1)
        }
      },

      play: async (id?: string, segmentIndex?: number) => {
        const state = get();
        
        try {
          // For iOS Safari, check user interaction first
          if (isIOSSafari() && !getUserInteraction()) {
            const initialized = await handleIOSAudioInit();
            if (!initialized) {
              set({ requiresUserInteraction: true });
              throw new Error('iOS requires user interaction to play audio');
            }
          }

          // Continue with normal play logic
          if (state.isPlaying && state.currentAudio) {
            state.currentAudio.pause();
            set({ isPlaying: false });
            return;
          }

          const targetId = id || (state.currentIndex !== null ? state.queue[state.currentIndex].id : state.queue[0]?.id);
          if (!targetId) return;

          const queueItem = state.queue.find(item => item.id === targetId);
          if (!queueItem) return;

          // Don't stop conversion on iOS interaction error
          try {
            if (queueItem.status === 'pending') {
              set(state => ({
                queue: state.queue.map(item =>
                  item.id === targetId
                    ? { ...item, status: 'converting' }
                    : item
                )
              }));

              // Convert all segments
              for (const segment of queueItem.segments) {
                if (segment.status === 'ready') continue;
                
                try {
                  const response = await fetch('/api/text-to-speech', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      text: segment.text,
                      voice: queueItem.voice
                    })
                  });

                  if (!response.ok) throw new Error('TTS API error');

                  const audioData = await response.arrayBuffer();
                  await storeAudioData(segment.id, audioData);
                  segment.status = 'ready';
                } catch (error) {
                  console.error('Segment conversion error:', error);
                  segment.status = 'error';
                  continue; // Continue with other segments
                }
              }
            }
          } catch (error) {
            console.error('Conversion error:', error);
            // Don't throw here - let playback attempt continue
          }

          // Try to play the current segment
          const startSegmentIndex = segmentIndex ?? queueItem.currentSegment ?? 0;
          const segment = queueItem.segments[startSegmentIndex];

          if (!segment?.audio) {
            const audioData = await getAudioData(segment.id);
            if (!audioData) return;

            const blob = new Blob([audioData], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            const audio = new Audio();
            if (isIOSSafari()) {
              audio.preload = 'none';
              audio.setAttribute('webkit-playsinline', 'true');
              audio.setAttribute('playsinline', 'true');
            }
            
            audio.src = url;
            await audio.load();
            
            // Add ended event listener for auto-play
            audio.addEventListener('ended', async () => {
              await get().next();
            });
            
            segment.audio = audio;
          }

          // Attempt playback
          try {
            await segment.audio.play();
            set({
              isPlaying: true,
              currentAudio: segment.audio,
              currentIndex: state.queue.findIndex(item => item.id === targetId),
              requiresUserInteraction: false
            });
          } catch (error) {
            if (isIOSSafari()) {
              set({ requiresUserInteraction: true });
              throw new Error('iOS requires user interaction to play audio');
            }
            throw error;
          }

        } catch (error) {
          console.error('Play error:', error);
          throw error;
        }
      },

      pause: () => {
        const state = get()
        if (state.currentAudio) {
          state.currentAudio.pause()
          set({ isPlaying: false })
        }
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

      rehydrateAudio: async () => {
        const state = get()
        
        // Rehydrate audio elements from IndexedDB
        for (const item of state.queue) {
          for (const segment of item.segments) {
            if (segment.status === 'ready') {
              try {
                const audioData = await getAudioData(segment.id)
                if (audioData) {
                  // Create blob from ArrayBuffer
                  const blob = new Blob([audioData], { type: 'audio/wav' })
                  segment.audio = new Audio(URL.createObjectURL(blob))
                  segment.status = 'ready'
                }
              } catch (error) {
                console.error(`Failed to rehydrate audio for segment ${segment.id}:`, error)
              }
            }
          }
        }
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
              // Convert blob to ArrayBuffer for storage
              const audioData = await audioBlob.arrayBuffer()
              
              console.log('Segment converted:', {
                audioDataLength: audioData.byteLength
              })
              
              // Store audio data in IndexedDB
              await storeAudioData(segment.id, audioData)
              
              // Create audio element
              const audio = createAudioElement()
              
              // Create blob from ArrayBuffer
              try {
                const blob = new Blob([audioData], { type: 'audio/wav' })
                const url = URL.createObjectURL(blob)
                
                // iOS Safari requires user interaction before playing audio
                const playPromise = () => {
                  return audio.play().catch(error => {
                    if (error.name === 'NotAllowedError') {
                      console.log('Playback requires user interaction first')
                      // We'll handle this in the UI layer
                      set({ requiresUserInteraction: true })
                    }
                    throw error
                  })
                }
                
                audio.src = url
                await audio.load() // Explicitly load the audio
              
                console.log('Audio src set and loading started', {
                  blobSize: blob.size,
                  blobType: blob.type
                })
              } catch (error) {
                console.error('Error loading audio:', error)
                throw new Error(`Failed to load audio: ${error}`)
              }
              
              // Update segment with audio
              set(state => ({
                queue: state.queue.map(qItem =>
                  qItem.id === id
                    ? {
                        ...qItem,
                        segments: qItem.segments.map((seg, index) =>
                          index === i
                            ? {
                                ...seg,
                                audio,
                                status: 'ready'
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
                        segments: qItem.segments.map((seg, index) =>
                          index === i
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
            audio: null // Don't persist audio elements
          }))
        })),
        currentIndex: state.currentIndex,
        volume: state.volume,
        muted: state.muted
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Rehydrating audio queue store:', state)
        if (state) {
          // Rehydrate audio elements for all segments
          state.queue.forEach(item => {
            item.segments.forEach(async (segment) => {
              try {
                const audioData = await getAudioData(segment.id)
                if (audioData) {
                  // Create blob from ArrayBuffer
                  const blob = new Blob([audioData], { type: 'audio/wav' })
                  segment.audio = new Audio(URL.createObjectURL(blob))
                  segment.status = 'ready'
                }
              } catch (error) {
                console.error('Error rehydrating audio:', error)
                segment.status = 'error'
                segment.error = 'Failed to load audio'
              }
            })
          })
        }
      }
    }
  )
)
