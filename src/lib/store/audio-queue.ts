import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { TTSError, convertTextToSpeech } from '../api/tts'
import { VoiceId } from './settings'
import { segmentText, TextSegment, PAUSE_DURATIONS } from '../utils/text-segmentation'
import { isIOSSafari } from '@/lib/utils/device';
import { handleIOSAudioInit, getUserInteraction } from '@/lib/utils/ios-audio';
import * as Sentry from '@sentry/nextjs';
import { getDb, storeAudioData, getAudioData, removeAudioData } from '../utils/indexed-db'
import { toneManager } from '../utils/tone-manager';

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
  currentAudio: null
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
  updateTime: (currentTime: number, duration: number) => void
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

const initializeAudioContext = () => {
  // Create new audio context with iOS compatible options
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext({
    latencyHint: 'interactive',
    sampleRate: 44100
  });
  
  // Resume audio context if it's suspended (required for iOS)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  
  return audioContext;
};

function createAudioElement(get: () => AudioQueueStore): void {
  toneManager.initializeContext();
  toneManager.setVolume(get().volume);
  toneManager.setMute(get().muted);
};

async function addAudioSegment(set: (updater: (state: AudioQueueStore) => AudioQueueStore) => void, segment: TextSegment, voice: VoiceId): Promise<void> {
  const audioData = await convertTextToSpeech(segment.text, voice);
  if (audioData && audioData[0]?.audio) {
    const arrayBuffer = await audioData[0].audio.arrayBuffer();
    await storeAudioData(segment.id, arrayBuffer);
    
    // Create blob URL for the audio data
    const blob = new Blob([arrayBuffer], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(blob);
    
    // Update the queue with the audio URL
    set((state: AudioQueueStore) => ({
      ...state,
      queue: state.queue.map(item => ({
        ...item,
        segments: item.segments.map(seg => 
          seg.id === segment.id
            ? { ...seg, audioUrl, status: 'ready' as AudioSegmentStatus }
            : seg
        )
      }))
    }));
  }
}

async function fetchAudioSegment(id: string): Promise<ArrayBuffer | null> {
  return await getAudioData(id);
}

async function deleteAudioSegment(id: string): Promise<void> {
  await removeAudioData(id);
}

async function clearAllAudioData(): Promise<void> {
  const db = await getDb();
  await db.table('audio-data').clear();
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
      requiresUserInteraction: false,

      updateTime: (currentTime: number, duration: number) => {
        console.log('[AUDIO_QUEUE] Updating time:', { currentTime, duration });
        set({ currentTime, duration });
      },

      add: async (text: string, voice: VoiceId, source?: string, imageUrl?: string) => {
        const state = get()
        const id = generateId()

        try {
          const segments = segmentText(text).map(segment => ({
            ...segment,
            id: generateId(),
            audioUrl: null,
            audio: null,
            status: 'pending' as AudioSegmentStatus
          }))

          set((state: AudioQueueStore) => ({
            ...state,
            queue: [...state.queue, {
              id,
              text,
              voice,
              source,
              imageUrl,
              segments,
              status: 'converting',
              error: null,
              currentSegment: 0,
              totalSegments: segments.length
            }]
          }))

          const MAX_PARALLEL_CONVERSIONS = 3
          const conversionQueue = [...segments]
          const inProgress = new Set<string>()
          const abortController = new AbortController()
          
          set({ isConverting: true, conversionAbortController: abortController })

          while (conversionQueue.length > 0 || inProgress.size > 0) {
            while (conversionQueue.length > 0 && inProgress.size < MAX_PARALLEL_CONVERSIONS) {
              const segment = conversionQueue.shift()!
              inProgress.add(segment.id)

              convertTextToSpeech(segment.text, voice, abortController.signal)
                .then(async (audioData) => {
                  try {
                    await addAudioSegment(set, segment, voice);
                    
                    set((state: AudioQueueStore) => ({
                      ...state,
                      queue: state.queue.map(item =>
                        item.id === id
                          ? {
                              ...item,
                              segments: item.segments.map(s =>
                                s.id === segment.id
                                  ? { ...s, status: 'ready' }
                                  : s
                              )
                            }
                          : item
                      )
                    }))

                    const currentState = get()
                    const queueItem = currentState.queue.find(item => item.id === id)
                    const isFirstSegment = queueItem && 
                                         segment.id === queueItem.segments[0].id && 
                                         !currentState.isPlaying && 
                                         currentState.currentIndex === null
                    
                    if (isFirstSegment && !isIOSSafari()) {
                      await get().play(id, 0)
                    } else if (isFirstSegment && isIOSSafari()) {
                      set({ requiresUserInteraction: true })
                    }
                  } catch (error) {
                    console.error('Failed to store audio data:', error)
                    set((state: AudioQueueStore) => ({
                      ...state,
                      queue: state.queue.map(item =>
                        item.id === id
                          ? {
                              ...item,
                              segments: item.segments.map(s =>
                                s.id === segment.id
                                  ? { ...s, status: 'error', error: 'Failed to store audio' }
                                  : s
                              )
                            }
                          : item
                      )
                    }))
                  }
                })
                .catch((error) => {
                  if (error instanceof TTSError) {
                    set((state: AudioQueueStore) => ({
                      ...state,
                      queue: state.queue.map(item =>
                        item.id === id
                          ? {
                              ...item,
                              segments: item.segments.map(s =>
                                s.id === segment.id
                                  ? { ...s, status: 'error', error: error.message }
                                  : s
                              )
                            }
                          : item
                      )
                    }))
                  }
                })
                .finally(() => {
                  inProgress.delete(segment.id)
                })
            }

            await new Promise(resolve => setTimeout(resolve, 100))

            if (abortController.signal.aborted) {
              break
            }
          }

          const finalState = get()
          const queueItem = finalState.queue.find(item => item.id === id)
          if (queueItem) {
            const hasErrors = queueItem.segments.some(s => s.status === 'error')
            const allReady = queueItem.segments.every(s => s.status === 'ready')
            set((state: AudioQueueStore) => ({
              ...state,
              queue: state.queue.map(item =>
                item.id === id
                  ? {
                      ...item,
                      status: hasErrors ? 'error' : (allReady ? 'ready' : 'partial'),
                      error: hasErrors ? 'Some segments failed to convert' : null
                    }
                  : item
              ),
              isConverting: false,
              conversionAbortController: null
            }))
          }
        } catch (error) {
          console.error('Failed to add item to queue:', error)
          set((state: AudioQueueStore) => ({
            ...state,
            queue: state.queue.map(item =>
              item.id === id
                ? { ...item, status: 'error', error: 'Failed to process text' }
                : item
            ),
            isConverting: false,
            conversionAbortController: null
          }))
        }
      },

      remove: async (id: string) => {
        const state = get()
        const item = state.queue.find(item => item.id === id)
        
        if (item) {
          await Promise.all(item.segments.map(segment => 
            deleteAudioSegment(segment.id)
          ))
        }
        
        set((state: AudioQueueStore) => ({
          ...state,
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
        const currentState = get();
        toneManager.cleanup(); // Clean up Tone.js resources
        await clearAllAudioData();
        set({
          queue: [],
          currentIndex: null,
          isPlaying: false,
          isConverting: false,
          conversionAbortController: null,
          currentTime: 0,
          duration: 0
        });
      },

      next: async () => {
        const state = get();
        if (state.currentIndex === null) return;

        const currentItem = state.queue[state.currentIndex];
        if (!currentItem) return;

        console.log('[AUDIO_QUEUE] Next called:', {
          currentSegment: currentItem.currentSegment,
          totalSegments: currentItem.totalSegments,
          queueLength: state.queue.length,
          currentIndex: state.currentIndex,
          segmentStatuses: currentItem.segments.map(s => ({
            status: s.status,
            hasAudio: !!s.audio,
            duration: s.audio?.duration
          }))
        });

        if (currentItem && currentItem.currentSegment < currentItem.totalSegments - 1) {
          const nextSegment = currentItem.currentSegment + 1;
          
          console.log('[AUDIO_QUEUE] Moving to next segment:', {
            from: currentItem.currentSegment,
            to: nextSegment,
            nextSegmentStatus: currentItem.segments[nextSegment]?.status,
            hasAudio: !!currentItem.segments[nextSegment]?.audio
          });

          set((state: AudioQueueStore) => ({
            ...state,
            queue: state.queue.map((item, i) =>
              i === state.currentIndex
                ? { ...item, currentSegment: nextSegment }
                : item
            )
          }));

          try {
            await get().play(currentItem.id, nextSegment);
            console.log('[AUDIO_QUEUE] Started playing next segment:', nextSegment);
          } catch (error) {
            console.error('[AUDIO_QUEUE] Failed to play next segment:', error);
          }
          return;
        }

        if (state.currentIndex < state.queue.length - 1) {
          const nextIndex = state.currentIndex + 1;
          const nextItem = state.queue[nextIndex];
          
          console.log('[AUDIO_QUEUE] Moving to next track:', {
            from: state.currentIndex,
            to: nextIndex,
            nextItemStatus: nextItem.status,
            nextItemSegments: nextItem.segments.map(s => ({
              status: s.status,
              hasAudio: !!s.audio
            }))
          });

          set({ ...state, currentIndex: nextIndex });
          
          try {
            await get().play(nextItem.id, 0);
            console.log('[AUDIO_QUEUE] Started playing next track');
          } catch (error) {
            console.error('[AUDIO_QUEUE] Failed to play next track:', error);
          }
          return;
        }

        console.log('[AUDIO_QUEUE] Reached end of queue');
        set({ 
          ...state,
          isPlaying: false,
          currentTime: 0,
          duration: 0
        });
      },

      previous: async () => {
        const { queue, currentIndex, currentAudio } = get()
        
        if (currentAudio) {
          // currentAudio.pause()
          // currentAudio.currentTime = 0
          // currentAudio.src = '' // Add this line to fully unload the audio
        }

        if (currentIndex === null) {
          if (queue.length > 0) {
            await get().play(queue[0].id, 0)
          }
          return
        }

        const currentItem = queue[currentIndex]

        if (currentItem && currentItem.currentSegment > 0) {
          set((state: AudioQueueStore) => ({
            ...state,
            queue: state.queue.map((item, idx) => 
              idx === currentIndex 
                ? { ...item, currentSegment: item.currentSegment - 1 }
                : item
            )
          }))
          await get().play(currentItem.id, currentItem.currentSegment - 1)
          return
        }

        if (currentIndex > 0) {
          const prevItem = queue[currentIndex - 1]
          set((state: AudioQueueStore) => ({
            ...state,
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

      togglePlayPause: async () => {
        const state = get(); // Get the current state
        if (state.isPlaying) {
            console.log("[AudioQueue] Pausing audio...");
            toneManager.pause();
            set(state => ({ ...state, isPlaying: false }));
        } else {
            console.log("[AudioQueue] Playing audio...");
            await toneManager.play(); // Ensure to await play if it's an async function
            set(state => ({ ...state, isPlaying: true }));
        }
    },

      play: async (id?: string, segmentIndex?: number) => {
        const state = get();
        let targetId = id;
        let targetSegmentIndex = segmentIndex;
        

        try {
          // Initialize audio context first
          await toneManager.initializeContext();

          if (!targetId && state.queue.length > 0) {
            if (state.currentIndex !== null) {
              targetId = state.queue[state.currentIndex].id;
            } else {
              targetId = state.queue[0].id;
            }
          }

          if (!targetId) {
            console.log('[AudioQueue] No target ID found');
            return;
          }

          const queueItemIndex = state.queue.findIndex(item => item.id === targetId);
          if (queueItemIndex === -1) {
            console.log('[AudioQueue] Queue item not found:', targetId);
            return;
          }

          const queueItem = state.queue[queueItemIndex];
          if (targetSegmentIndex === undefined) {
            targetSegmentIndex = queueItem.currentSegment;
          }

          const segment = queueItem.segments[targetSegmentIndex];
          if (!segment || !segment.audioUrl) {
            console.log('[AudioQueue] No audio URL for segment:', targetSegmentIndex);
            return;
          }

          console.log('[AUDIO_QUEUE] Loading audio:', {
            targetId,
            segmentIndex: targetSegmentIndex,
            audioUrl: segment.audioUrl
          });

          await toneManager.loadAudio(segment.audioUrl);
          
          // Set up autoplay callback before starting playback
          toneManager.setOnEndCallback(async () => {
            console.log('[AudioQueue] Audio ended, checking for next item');
            const currentState = get();
            
            // If we're still playing (not manually paused)
            if (currentState.isPlaying) {
              // Check if there are more segments in the current item
              const currentItem = currentState.queue[queueItemIndex];
              if (currentItem && typeof targetSegmentIndex === 'number' && targetSegmentIndex < currentItem.totalSegments - 1) {
                console.log('[AudioQueue] Playing next segment');
                await get().play(targetId, targetSegmentIndex + 1);
              } else {
                // Move to the next item in queue
                console.log('[AudioQueue] Current item finished, moving to next in queue');
                await get().next();
              }
            }
          });

          await toneManager.play();
          console.log('[AudioQueue] Audio playing successfully');

          set(state => ({
            ...state,
            currentIndex: queueItemIndex,
            isPlaying: true,
            queue: state.queue.map(item => 
              item.id === targetId
                ? {
                    ...item,
                    currentSegment: targetSegmentIndex!,
                    status: 'playing',
                    segments: item.segments.map((seg, idx) => ({
                      ...seg,
                      status: idx === targetSegmentIndex ? 'playing' : seg.status
                    }))
                  }
                : item
            )
          }));
        } catch (error) {
          console.error('[AudioQueue] Error in play function:', error);
          set(state => ({
            ...state,
            isPlaying: false,
            queue: state.queue.map(item =>
              item.id === targetId
                ? {
                    ...item,
                    status: 'error',
                    error: error instanceof Error ? error.message : 'Failed to play audio'
                  }
                : item
            )
          }));
          throw error;
        }
      },

      pause: () => {
        console.log("[AudioQueue] Pausing audio...");
        toneManager.pause();
        set(state => ({ ...state, isPlaying: false }));
      },

      setStatus: (id: string, status: QueueItemStatus, error?: string) => {
        set((state: AudioQueueStore) => ({
          ...state,
          queue: state.queue.map(item =>
            item.id === id
              ? {
                  ...item,
                  status,
                  ...(error && { error })
                }
              : item
          )
        }))
      },

      cancelConversion: () => {
        const { conversionAbortController, queue, currentIndex } = get()
        if (conversionAbortController) {
          conversionAbortController.abort()
          
          set((state: AudioQueueStore) => {
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
              ...state,
              isConverting: false,
              conversionAbortController: null,
              queue: updatedQueue
            }
          })
        }
      },

      setVolume: (volume: number) => {
        toneManager.setVolume(volume);
        set(state => ({ ...state, volume }));
      },

      toggleMute: () => {
        const newMuted = !get().muted;
        toneManager.setMute(newMuted);
        set(state => ({ ...state, muted: newMuted }));
      },

      rehydrateAudio: async () => {
        const state = get()
        
        for (const item of state.queue) {
          for (const segment of item.segments) {
            if (segment.status === 'ready' || segment.status === 'pending') {
              try {
                const audioData = await fetchAudioSegment(segment.id)
                if (audioData) {
                  const blob = new Blob([audioData], { type: 'audio/wav' })
                  // segment.audio = new Audio(URL.createObjectURL(blob))
                  segment.status = 'ready'
                }
              } catch (error) {
                console.error('Error rehydrating audio:', error)
                segment.status = 'error'
                segment.error = 'Failed to load audio'
              }
            }
          }
        }
        
        set({ ...state, queue: [...state.queue] })
      },

      resumeConversion: async (id: string, voice: VoiceId) => {
        const { queue } = get()
        const item = queue.find(item => item.id === id)
        if (!item) return

        const abortController = new AbortController()
        
        const currentState = get();
        set({ 
          ...currentState,
          isConverting: true,
          conversionAbortController: abortController
        })

        try {
          for (let i = 0; i < item.segments.length; i++) {
            const segment = item.segments[i]
            
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

              const arrayBuffer = await response.arrayBuffer()
              const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
              const audioUrl = URL.createObjectURL(audioBlob)
              
              set((state: AudioQueueStore) => ({
                ...state,
                queue: state.queue.map(item =>
                  item.id === id
                    ? {
                        ...item,
                        segments: item.segments.map((seg, idx) => ({
                          ...seg,
                          audioUrl,
                          status: 'ready' as AudioSegmentStatus,
                          error: undefined
                        }))
                      }
                    : item
                )
              }))
            } catch (error) {
              if ((error as { name: string }).name === 'AbortError') throw error
              
              console.error(`Error converting segment ${i}:`, error)
              set((state: AudioQueueStore) => ({
                ...state,
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
            set((state: AudioQueueStore) => ({
              ...state,
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

          set((state: AudioQueueStore) => ({
            ...state,
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

        set((state: AudioQueueStore) => ({
          ...state,
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
        if (!state) {
          return {
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
            requiresUserInteraction: false
          };
        }
        console.log('Rehydrating audio queue store:', state)
        if (state) {
          state.queue.forEach(item => {
            item.segments.forEach(async (segment) => {
              try {
                const audioData = await fetchAudioSegment(segment.id)
                if (audioData) {
                  const blob = new Blob([audioData], { type: 'audio/wav' })
                  // segment.audio = new Audio(URL.createObjectURL(blob))
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
        
        return {
          ...state,
          queue: state.queue,
          currentIndex: state.currentIndex,
          isPlaying: false,
          currentAudio: null,
          isConverting: false,
          conversionAbortController: null,
          volume: state.volume,
          muted: state.muted,
          currentTime: 0,
          duration: 0,
          requiresUserInteraction: false
        }
      }
    }
  )
)
