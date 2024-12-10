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

          set(state => ({
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
                    const audioUrl = await storeAudioData(audioData)
                    
                    set(state => ({
                      queue: state.queue.map(item =>
                        item.id === id
                          ? {
                              ...item,
                              segments: item.segments.map(s =>
                                s.id === segment.id
                                  ? { ...s, audioUrl, status: 'ready' }
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
                    set(state => ({
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
                    set(state => ({
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
            set(state => ({
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
          set(state => ({
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
        const state = get()
        if (state.currentAudio) {
          state.currentAudio.pause()
          state.currentAudio.currentTime = 0
        }
        
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

        if (currentItem.currentSegment < currentItem.totalSegments - 1) {
          const nextSegment = currentItem.currentSegment + 1;
          
          console.log('[AUDIO_QUEUE] Moving to next segment:', {
            from: currentItem.currentSegment,
            to: nextSegment,
            nextSegmentStatus: currentItem.segments[nextSegment]?.status,
            hasAudio: !!currentItem.segments[nextSegment]?.audio
          });

          set(state => ({
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

          set({ currentIndex: nextIndex });
          
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
          isPlaying: false,
          currentTime: 0,
          duration: 0
        });
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

        if (currentItem && currentItem.currentSegment > 0) {
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

        if (currentIndex > 0) {
          const prevItem = queue[currentIndex - 1]
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
          console.log('[AUDIO_QUEUE] Play called:', {
            id,
            segmentIndex,
            currentState: {
              isPlaying: state.isPlaying,
              currentIndex: state.currentIndex,
              hasCurrentAudio: !!state.currentAudio
            }
          });

          if (isIOSSafari() && !getUserInteraction()) {
            const initialized = await handleIOSAudioInit();
            if (!initialized) {
              set({ requiresUserInteraction: true });
              throw new Error('iOS requires user interaction to play audio');
            }
          }

          if (state.currentAudio) {
            state.currentAudio.pause();
            state.currentAudio.currentTime = 0;
            state.currentAudio.removeEventListener('timeupdate', state.currentAudio.ontimeupdate as any);
            state.currentAudio.removeEventListener('ended', state.currentAudio.onended as any);
            state.currentAudio.removeEventListener('error', state.currentAudio.onerror as any);
            set({ currentAudio: null, currentTime: 0, duration: 0 });
          }

          const targetId = id || (state.currentIndex !== null ? state.queue[state.currentIndex].id : state.queue[0]?.id);
          if (!targetId) {
            console.log('[AUDIO_QUEUE] No target ID found');
            return;
          }

          const queueItem = state.queue.find(item => item.id === targetId);
          if (!queueItem) {
            console.log('[AUDIO_QUEUE] Queue item not found:', targetId);
            return;
          }

          let nextSegmentIndex = segmentIndex ?? queueItem.currentSegment ?? 0;
          while (nextSegmentIndex < queueItem.totalSegments) {
            const segment = queueItem.segments[nextSegmentIndex];
            if (segment?.status === 'ready' && segment.audioUrl) {
              break;
            }
            nextSegmentIndex++;
          }

          if (nextSegmentIndex >= queueItem.totalSegments) {
            console.log('[AUDIO_QUEUE] No ready segments found');
            return;
          }

          const segment = queueItem.segments[nextSegmentIndex];
          console.log('[AUDIO_QUEUE] Setting up segment:', {
            targetId,
            segmentIndex: nextSegmentIndex,
            hasAudio: !!segment?.audio,
            audioUrl: segment.audioUrl,
            status: segment.status
          });

          if (nextSegmentIndex !== queueItem.currentSegment) {
            set(state => ({
              queue: state.queue.map(item =>
                item.id === queueItem.id
                  ? { ...item, currentSegment: nextSegmentIndex }
                  : item
              )
            }));
          }

          if (!segment.audio) {
            const audio = createAudioElement();
            
            const handleTimeUpdate = () => {
              if (!audio.duration) return;
              get().updateTime(audio.currentTime, audio.duration);
            };

            const handleEnded = async () => {
              console.log('[AUDIO_QUEUE] Segment ended:', {
                currentSegment: nextSegmentIndex,
                totalSegments: queueItem.totalSegments
              });

              audio.removeEventListener('timeupdate', handleTimeUpdate);
              audio.removeEventListener('ended', handleEnded);
              audio.removeEventListener('error', handleError);
              
              if (get().currentAudio === audio) {
                set({ currentAudio: null, currentTime: 0 });

                const nextState = get();
                const currentItem = nextState.queue.find(item => item.id === targetId);
                if (currentItem) {
                  const nextSegmentIndex = currentItem.currentSegment + 1;
                  
                  // Check if we've reached the end of the queue item
                  if (nextSegmentIndex >= currentItem.totalSegments) {
                    console.log('[AUDIO_QUEUE] Reached end of queue item');
                    set({ isPlaying: false });
                    await get().next(); // Try to play next item in queue
                    return;
                  }

                  try {
                    // Pre-load next segment if it exists but isn't ready
                    if (nextSegmentIndex + 1 < currentItem.totalSegments) {
                      const futureSegment = currentItem.segments[nextSegmentIndex + 1];
                      if (futureSegment && !futureSegment.audio && futureSegment.audioUrl) {
                        const preloadAudio = createAudioElement();
                        preloadAudio.src = futureSegment.audioUrl;
                        preloadAudio.load();
                        futureSegment.audio = preloadAudio;
                      }
                    }

                    await get().play(targetId, nextSegmentIndex);
                  } catch (error) {
                    console.error('[AUDIO_QUEUE] Failed to play next segment:', error);
                    // If current segment fails, try the next one
                    if (nextSegmentIndex + 1 < currentItem.totalSegments) {
                      try {
                        await get().play(targetId, nextSegmentIndex + 1);
                      } catch (e) {
                        console.error('[AUDIO_QUEUE] Failed to play skip-ahead segment:', e);
                        set({ isPlaying: false });
                      }
                    } else {
                      set({ isPlaying: false });
                    }
                  }
                }
              }
            };

            const handleError = async (error: ErrorEvent) => {
              const errorDetails = {
                segment: nextSegmentIndex,
                error: error.message,
                status: error.target instanceof HTMLAudioElement ? error.target.error?.code : 'unknown'
              };
              console.error('[AUDIO_QUEUE] Audio error:', errorDetails);
              
              audio.removeEventListener('timeupdate', handleTimeUpdate);
              audio.removeEventListener('ended', handleEnded);
              audio.removeEventListener('error', handleError);
              
              if (get().currentAudio === audio) {
                try {
                  const currentState = get();
                  const currentItem = currentState.queue.find(item => item.id === targetId);
                  const currentSegment = currentItem?.segments[nextSegmentIndex];
                  
                  // Mark current segment as error
                  set(state => ({
                    queue: state.queue.map(item =>
                      item.id === targetId
                        ? {
                            ...item,
                            segments: item.segments.map((seg, idx) =>
                              idx === nextSegmentIndex
                                ? { ...seg, status: 'error' as AudioSegmentStatus, error: errorDetails.error }
                                : seg
                            )
                          }
                        : item
                    )
                  }));

                  // Try to find the next playable segment
                  const findNextPlayableSegment = async (startIndex: number): Promise<number | null> => {
                    if (!currentItem) return null;
                    
                    for (let i = startIndex; i < currentItem.totalSegments; i++) {
                      const segment = currentItem.segments[i];
                      if (!segment?.audioUrl) continue;
                      
                      try {
                        const response = await fetch(segment.audioUrl, { method: 'HEAD' });
                        if (response.ok) {
                          return i;
                        }
                      } catch (e) {
                        console.warn(`[AUDIO_QUEUE] Failed to check segment ${i}:`, e);
                      }
                    }
                    return null;
                  };

                  // First try to find the next playable segment
                  const nextPlayableIndex = await findNextPlayableSegment(nextSegmentIndex + 1);
                  if (nextPlayableIndex !== null) {
                    await get().play(targetId, nextPlayableIndex);
                    return;
                  }

                  // If no immediately playable segments, wait for conversion
                  let attempts = 0;
                  const maxAttempts = 5;
                  const waitForSegment = async () => {
                    if (attempts >= maxAttempts) {
                      console.error('[AUDIO_QUEUE] No playable segments found after max attempts');
                      get().pause();
                      set(state => ({
                        queue: state.queue.map(item =>
                          item.id === targetId
                            ? { ...item, error: 'Failed to play audio after multiple attempts' }
                            : item
                        )
                      }));
                      return;
                    }
                    
                    attempts++;
                    const delayMs = 1000 * Math.pow(1.5, attempts - 1);
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                    
                    const latestState = get();
                    const latestItem = latestState.queue.find(item => item.id === targetId);
                    
                    if (!latestItem) {
                      console.warn('[AUDIO_QUEUE] Item no longer in queue');
                      return;
                    }

                    // Check for any ready segments from current position
                    const nextReady = await findNextPlayableSegment(nextSegmentIndex);
                    if (nextReady !== null) {
                      await get().play(targetId, nextReady);
                      return;
                    }

                    await waitForSegment();
                  };
                  
                  await waitForSegment();
                } catch (e) {
                  console.error('[AUDIO_QUEUE] Error handling segment error:', e);
                  get().pause();
                  
                  set(state => ({
                    queue: state.queue.map(item =>
                      item.id === targetId
                        ? { ...item, error: 'Failed to recover from playback error' }
                        : item
                    )
                  }));
                }
              }
            };

            audio.addEventListener('timeupdate', handleTimeUpdate);
            audio.addEventListener('ended', handleEnded);
            audio.addEventListener('error', handleError);
            audio.src = segment.audioUrl;
            segment.audio = audio;
          }

          const audioToPlay = segment.audio!;
          audioToPlay.volume = state.muted ? 0 : state.volume;

          set({ 
            currentAudio: audioToPlay,
            isPlaying: true,
            currentIndex: state.queue.findIndex(item => item.id === targetId),
            currentTime: 0
          });

          try {
            if (audioToPlay.readyState >= 2) {
              await audioToPlay.play();
            } else {
              await new Promise((resolve, reject) => {
                const canPlay = async () => {
                  audioToPlay.removeEventListener('canplay', canPlay);
                  try {
                    await audioToPlay.play();
                    resolve(true);
                  } catch (e) {
                    reject(e);
                  }
                };
                audioToPlay.addEventListener('canplay', canPlay);
              });
            }
            
            console.log('[AUDIO_QUEUE] Successfully started playback:', {
              segment: nextSegmentIndex + 1,
              currentTime: audioToPlay.currentTime,
              duration: audioToPlay.duration
            });
          } catch (error) {
            console.error('[AUDIO_QUEUE] Play error:', error);
            set({ isPlaying: false, currentAudio: null });
            await get().play(targetId, nextSegmentIndex + 1);
          }
        } catch (error) {
          console.error('[AUDIO_QUEUE] Play error:', error);
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
        const currentAudio = get().currentAudio
        if (currentAudio) {
          currentAudio.volume = volume
        }
      },

      toggleMute: () => {
        set(state => ({ muted: !state.muted }))
        const currentAudio = get().currentAudio
        if (currentAudio) {
          currentAudio.muted = get().muted
        }
      },

      rehydrateAudio: async () => {
        const state = get()
        
        for (const item of state.queue) {
          for (const segment of item.segments) {
            if (segment.status === 'ready' || segment.status === 'pending') {
              try {
                const audioData = await getAudioData(segment.id)
                if (audioData) {
                  const blob = new Blob([audioData], { type: 'audio/wav' })
                  segment.audio = new Audio(URL.createObjectURL(blob))
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
        
        set({ queue: [...state.queue] })
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

              const audioBlob = await response.blob()
              const audioData = await audioBlob.arrayBuffer()
              
              console.log('Segment converted:', {
                audioDataLength: audioData.byteLength
              })
              
              await storeAudioData(segment.id, audioData)
              
              const blob = new Blob([audioData], { type: 'audio/wav' })
              const url = URL.createObjectURL(blob)
              
              const audio = createAudioElement()
              audio.src = url
              await audio.load() // Explicitly load the audio
                
              segment.audioUrl = url
              segment.audio = audio
              segment.status = 'ready'

              const readySegments = item.segments.reduce((count, s) => {
                return count + (s.status === 'ready' ? 1 : 0)
              }, 0)

              console.log('[AUDIO_QUEUE] Segment conversion status:', {
                segmentId: segment.id,
                url,
                currentSegment: i + 1,
                totalSegments: item.segments.length,
                readySegments,
                allSegmentsReady: readySegments === item.segments.length
              })

              if (readySegments === item.segments.length) {
                item.status = 'ready'
              }

              set(state => ({
                queue: state.queue.map(item =>
                  item.id === id ? { ...item } : item
                )
              }))
            } catch (error) {
              if ((error as { name: string }).name === 'AbortError') throw error
              
              console.error(`Error converting segment ${i}:`, error)
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
          state.queue.forEach(item => {
            item.segments.forEach(async (segment) => {
              try {
                const audioData = await getAudioData(segment.id)
                if (audioData) {
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
