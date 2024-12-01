'use client'

import { useState, useCallback, useEffect } from 'react'

interface AudioSegment {
  audio?: HTMLAudioElement;
  status: 'ready' | 'loading' | 'error';
  type: string;
  text?: string;
}

interface AudioItem {
  id: string;
  status: 'playing' | 'paused' | 'ready' | 'partial';
  segments: AudioSegment[];
  currentSegment: number;
  totalSegments: number;
  text: string;
  voice: string;
}

interface UseAudioPlayerOptions {
  onSegmentEnd?: () => void;
  onQueueEnd?: () => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const [queue, setQueue] = useState<AudioItem[]>([])
  const [currentIndex, setCurrentIndex] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)

  const currentItem = currentIndex !== null ? queue[currentIndex] : undefined

  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const context = new AudioContext()
    setAudioContext(context)

    // Clean up on unmount
    return () => {
      if (context) {
        context.close()
      }
    }
  }, [])

  const ensureAudioContextResumed = useCallback(async () => {
    if (audioContext?.state === 'suspended') {
      try {
        await audioContext.resume()
      } catch (error) {
        console.error('Failed to resume audio context:', error)
      }
    }
  }, [audioContext])

  const play = useCallback(async () => {
    if (!currentItem) return

    const segment = currentItem.segments[currentItem.currentSegment]
    if (!segment?.audio) return

    try {
      // Ensure audio context is resumed before playing
      await ensureAudioContextResumed()
      
      // For iOS, we need to load the audio again if it's in a suspended state
      if (segment.audio.readyState === 0 || segment.audio.readyState === 1) {
        console.log('Reloading audio for iOS...');
        await new Promise((resolve, reject) => {
          const loadTimeout = setTimeout(() => {
            reject(new Error('Audio load timeout'));
          }, 5000);

          segment.audio!.load();
          
          segment.audio!.oncanplaythrough = () => {
            clearTimeout(loadTimeout);
            resolve(true);
          };
          
          segment.audio!.onerror = () => {
            clearTimeout(loadTimeout);
            reject(new Error('Audio load failed'));
          };
        });
      }

      // Attempt to play
      try {
        await segment.audio.play();
      } catch (error) {
        if (error instanceof Error && error.name === 'NotAllowedError') {
          throw new Error('iOS requires user interaction');
        }
        throw error;
      }

      setIsPlaying(true)
      
      // Update item status
      setQueue(prev => prev.map((item, i) => 
        i === currentIndex 
          ? { ...item, status: 'playing' as const }
          : item
      ))
    } catch (error) {
      console.error('Failed to play audio:', error)
      throw error;
    }
  }, [currentItem, currentIndex, ensureAudioContextResumed])

  const pause = useCallback(() => {
    if (!currentItem) return

    const segment = currentItem.segments[currentItem.currentSegment]
    if (!segment?.audio) return

    segment.audio.pause()
    setIsPlaying(false)
    
    // Update item status
    setQueue(prev => prev.map((item, i) => 
      i === currentIndex 
        ? { ...item, status: 'paused' as const }
        : item
    ))
  }, [currentItem, currentIndex])

  const next = useCallback(() => {
    if (!currentItem) return

    // First try next segment
    if (currentItem.currentSegment < currentItem.totalSegments - 1) {
      setQueue(prev => prev.map((item, i) => 
        i === currentIndex 
          ? { ...item, currentSegment: item.currentSegment + 1 }
          : item
      ))
      return
    }

    // If no more segments, try next item
    if (currentIndex !== null && currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      // End of queue
      options.onQueueEnd?.()
    }
  }, [currentItem, currentIndex, queue.length, options])

  const previous = useCallback(() => {
    if (!currentItem) return

    // First try previous segment
    if (currentItem.currentSegment > 0) {
      setQueue(prev => prev.map((item, i) => 
        i === currentIndex 
          ? { ...item, currentSegment: item.currentSegment - 1 }
          : item
      ))
      return
    }

    // If no more segments, try previous item
    if (currentIndex !== null && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentItem, currentIndex])

  const setAudioVolume = useCallback((newVolume: number) => {
    if (!currentItem) return

    const segment = currentItem.segments[currentItem.currentSegment]
    if (!segment?.audio) return

    segment.audio.volume = newVolume
    setVolume(newVolume)
    
    if (newVolume === 0) {
      setIsMuted(true)
    } else if (isMuted) {
      setIsMuted(false)
    }
  }, [currentItem, isMuted])

  const toggleMute = useCallback(() => {
    if (!currentItem) return

    const segment = currentItem.segments[currentItem.currentSegment]
    if (!segment?.audio) return

    if (isMuted) {
      segment.audio.volume = volume
      setIsMuted(false)
    } else {
      segment.audio.volume = 0
      setIsMuted(true)
    }
  }, [currentItem, volume, isMuted])

  const addToQueue = useCallback((item: AudioItem) => {
    setQueue(prev => [...prev, item])
    if (currentIndex === null) {
      setCurrentIndex(0)
    }
  }, [currentIndex])

  const removeFromQueue = useCallback((itemId: string) => {
    setQueue(prev => {
      const index = prev.findIndex(item => item.id === itemId)
      if (index === -1) return prev

      const newQueue = [...prev]
      newQueue.splice(index, 1)

      // Adjust currentIndex if necessary
      if (currentIndex !== null) {
        if (index < currentIndex) {
          setCurrentIndex(currentIndex - 1)
        } else if (index === currentIndex) {
          if (newQueue.length === 0) {
            setCurrentIndex(null)
          } else if (index === newQueue.length) {
            setCurrentIndex(index - 1)
          }
        }
      }

      return newQueue
    })
  }, [currentIndex])

  const clearQueue = useCallback(() => {
    setQueue([])
    setCurrentIndex(null)
    setIsPlaying(false)
  }, [])

  return {
    queue,
    currentIndex,
    currentItem,
    isPlaying,
    volume,
    isMuted,
    play,
    pause,
    next,
    previous,
    setVolume: setAudioVolume,
    toggleMute,
    addToQueue,
    removeFromQueue,
    clearQueue,
  }
}
