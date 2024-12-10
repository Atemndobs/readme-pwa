'use client'

import React, { useEffect, useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { 
  Loader2, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  X, 
  Minus,
  Volume2,
  VolumeX 
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getAudioImage } from '@/lib/utils/image-generator'
import { performCleanup } from '@/lib/utils/storage-cleanup'
import { ProgressBar } from './progress-bar'
import { Slider } from '@/components/ui/slider'
import Image from 'next/image'
import { isIOSSafari } from '@/lib/utils/device';
import { setUserInteraction, handleIOSAudioInit, cleanupIOSAudio, needsUserInteraction } from '@/lib/utils/ios-audio';

interface MiniPlayerProps {
  onClose?: () => void
}

export function MiniPlayer({ onClose }: MiniPlayerProps) {
  const { 
    queue, 
    currentIndex, 
    isPlaying, 
    play, 
    pause, 
    next, 
    previous, 
    remove, 
    clear, 
    isConverting,
    cancelConversion,
    resumeConversion,
    volume,
    setVolume,
    muted,
    toggleMute,
    requiresUserInteraction,
    updateTime
  } = useAudioQueue()

  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false)
  const [audioVisual, setAudioVisual] = React.useState<{ url: string | null; background: string }>({
    url: null,
    background: 'linear-gradient(45deg, hsl(230, 70%, 50%), hsl(200, 70%, 50%))'
  })

  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [initialVolume, setInitialVolume] = useState<number>(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const retryTimeoutRef = useRef<NodeJS.Timeout>()
  const maxRetries = useRef(3)
  const currentRetries = useRef(0)

  const handlePlay = useCallback(async () => {
    try {
      if (isIOSSafari() && needsUserInteraction()) {
        const initialized = await handleIOSAudioInit()
        if (!initialized) {
          console.log('[MiniPlayer] iOS audio initialization failed')
          return
        }
      }

      if (currentIndex !== null) {
        await play(queue[currentIndex].id)
        currentRetries.current = 0 // Reset retry counter on successful play
      } else if (queue.length > 0) {
        await play(queue[0].id)
        currentRetries.current = 0
      }
    } catch (error) {
      console.error('[MiniPlayer] Play error:', error)
      
      // Implement retry logic with exponential backoff
      if (currentRetries.current < maxRetries.current) {
        const backoffDelay = Math.pow(2, currentRetries.current) * 1000
        console.log(`[MiniPlayer] Retrying play in ${backoffDelay}ms (attempt ${currentRetries.current + 1})`)
        
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
        }
        
        retryTimeoutRef.current = setTimeout(() => {
          currentRetries.current++
          handlePlay()
        }, backoffDelay)
      }
    }
  }, [currentIndex, queue, play])

  const handlePause = useCallback(() => {
    pause()
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
    currentRetries.current = 0
  }, [pause])

  // Handle volume changes
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(Math.max(0, Math.min(1, newVolume)))
  }, [setVolume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      cleanupIOSAudio()
    }
  }, [])

  // Reset retry counter when queue or current item changes
  useEffect(() => {
    currentRetries.current = 0
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
    }
  }, [queue, currentIndex])

  const currentItem = currentIndex !== null ? queue[currentIndex] : null
  const hasItems = queue.length > 0

  // Test CI/CD Pipeline - Added comment to trigger deployment
  // Debug current state and progress bar conditions
  React.useEffect(() => {
    console.log('[PROGRESS_BAR] MiniPlayer State:', {
      queueLength: queue.length,
      currentIndex,
      isPlaying,
      currentItem: currentItem ? {
        id: currentItem.id,
        status: currentItem.status,
        totalSegments: currentItem.totalSegments,
        currentSegment: currentItem.currentSegment,
        readySegments: currentItem.segments.filter(s => s.status === 'ready').length,
        hasAudioData: currentItem.segments.some(s => s.audio?.duration ?? 0 > 0),
        segmentStatuses: currentItem.segments.map(s => s.status)
      } : null,
      shouldShowProgressBar: !!(
        currentItem && 
        ['playing', 'paused', 'ready', 'partial'].includes(currentItem.status) && 
        currentItem.segments.some(s => (s.audio?.duration ?? 0) > 0)
      )
    })
  }, [queue, currentIndex, isPlaying, currentItem])

  // Update audio visual when current item changes
  React.useEffect(() => {
    if (currentItem) {
      getAudioImage(currentItem.text, currentItem.voice).then(setAudioVisual)
    }
  }, [currentItem?.id])

  // Show a toast when user interaction is required (iOS)
  React.useEffect(() => {
    if (requiresUserInteraction) {
      toast("Please tap play to enable audio");
    }
  }, [requiresUserInteraction])

  // Detect touch device on mount
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // Update current time and handle track completion
  React.useEffect(() => {
    if (!currentItem?.segments[currentItem.currentSegment]?.audio) return;
    
    const audio = currentItem.segments[currentItem.currentSegment].audio!;
    
    const handleTimeUpdate = () => {
      updateTime(audio.currentTime, audio.duration);
    };

    const handleEnded = async () => {
      console.log('[MINI_PLAYER] Audio segment ended');
      
      // If this was the last segment of the current track
      if (currentItem.currentSegment === currentItem.totalSegments - 1) {
        console.log('[MINI_PLAYER] Last segment completed, moving to next track');
        await next(); // Move to next track in queue
      }
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    
    // Initial update
    if (audio.duration) {
      updateTime(audio.currentTime, audio.duration);
    }
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentItem?.id, currentItem?.currentSegment, updateTime, next]);

  const handleNext = async () => {
    try {
      console.log('Next button clicked')
      // Run cleanup if needed before loading next
      await performCleanup()
      await next()
    } catch (error) {
      console.error('Next track error:', error)
      toast.error("Failed to play next track");
    }
  }

  const handlePrevious = async () => {
    try {
      console.log('Previous button clicked')
      // Run cleanup if needed before loading previous
      await performCleanup()
      await previous()
    } catch (error) {
      console.error('Previous track error:', error)
      toast.error("Failed to play previous track");
    }
  }

  const handleClearQueue = () => {
    console.log('Clearing queue')
    clear()
    onClose?.() // This will trigger handleClosePlayer in page.tsx
    toast.success('Queue cleared')
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY)
    setInitialVolume(volume)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (touchStartY === null) return

    const touchDelta = (touchStartY - e.touches[0].clientY) * 0.005
    const newVolume = Math.max(0, Math.min(1, initialVolume + touchDelta))
    setVolume(newVolume)
  }

  const handleTouchEnd = () => {
    setTouchStartY(null)
  }

  const PlayButton = () => {
    const needsInteraction = isIOSSafari() && requiresUserInteraction
    const currentItem = queue[currentIndex ?? 0]
    const isConverting = currentItem?.status === 'converting'
    
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePlay}
        className="relative"
        disabled={!currentItem}
      >
        {isPlaying ? (
          <Pause className="h-6 w-6" />
        ) : (
          <>
            <Play className="h-6 w-6" />
            {needsInteraction && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
            {isConverting && (
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-spin absolute inline-flex h-full w-full rounded-full border-2 border-primary border-t-transparent"></span>
              </span>
            )}
          </>
        )}
      </Button>
    )
  }

  if (!hasItems && !isConverting) {
    console.log('MiniPlayer hidden: no items and not converting')
    return null
  }

  return (
    <Card className="fixed bottom-0 left-0 right-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Dynamic Image/Gradient */}
          <div 
            className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden"
            style={{ 
              background: audioVisual.background,
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
            }}
          >
            {audioVisual.url ? (
              <Image 
                src={audioVisual.url} 
                alt="Audio cover" 
                fill
                className="object-cover"
                sizes="64px"
                onError={(e) => {
                  // On error, we already have the gradient background as fallback
                  (e.target as HTMLImageElement).style.opacity = '0'
                }}
              />
            ) : (
              // Optional: Add an icon or wave animation here
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Volume2 className="w-8 h-8" />
              </div>
            )}
          </div>

          {/* Title and Status */}
          <div className="flex-1 min-w-0">
            {isConverting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <div>
                  <p className="text-sm">Converting text to speech...</p>
                  {currentItem && (
                    <p className="text-xs text-muted-foreground">
                      {currentItem.segments.filter(s => s.status === 'ready').length} of {currentItem.totalSegments} segments ready
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelConversion()}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : currentItem?.status === 'partial' ? (
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm">Partially converted</p>
                  <p className="text-xs text-muted-foreground">
                    {currentItem.segments.filter(s => s.status === 'ready').length} of {currentItem.totalSegments} segments available
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resumeConversion(currentItem.id, currentItem.voice)}
                    className="text-xs"
                  >
                    Resume Conversion
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium truncate">
                  {currentItem?.segments[currentItem.currentSegment]?.text || 'No track selected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Part {(currentItem?.currentSegment ?? 0) + 1} of {currentItem?.totalSegments ?? 0}
                  {queue.length > 1 && ` • ${queue.length} items in queue`}
                </p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {isConverting ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-red-100 hover:text-red-600"
                onClick={() => {
                  cancelConversion()
                  toast.success("Conversion cancelled");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={handleClearQueue}
                disabled={!hasItems}
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {(() => {
          console.log('Progress Bar Debug:', {
            hasCurrentItem: !!currentItem,
            status: currentItem?.status,
            totalSegments: currentItem?.totalSegments,
            currentSegment: currentItem?.currentSegment,
            segments: currentItem?.segments.map(s => ({
              id: s.id,
              status: s.status,
              hasAudio: !!s.audio,
              audioUrl: s.audioUrl,
              error: s.error
            }))
          })
          
          const shouldShowProgress = currentItem && ['playing', 'paused', 'ready', 'partial'].includes(currentItem.status)
          console.log('Should show progress bar:', shouldShowProgress, {
            itemStatus: currentItem?.status,
            segmentsReady: currentItem?.segments.every(s => s.status === 'ready')
          })

          return shouldShowProgress && (
            <div className="space-y-2">
              <ProgressBar onSeek={async (segmentIndex) => {
                try {
                  console.log('Seeking to segment:', segmentIndex)
                  await play(currentItem.id, segmentIndex)
                } catch (error) {
                  console.error('Seek error:', error)
                  toast.error("Failed to seek to position");
                }
              }} />
            </div>
          )
        })()}

        <div className="flex items-center justify-center space-x-4">
          {/* Volume Control */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 relative z-10"
              onClick={toggleMute}
              onTouchStart={isTouchDevice ? handleTouchStart : undefined}
              onTouchMove={isTouchDevice ? handleTouchMove : undefined}
              onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
            >
              {/* Volume Icon with circular indicator for mobile */}
              <div className="relative">
                {isTouchDevice && touchStartY !== null && (
                  <>
                    {/* Background Circle */}
                    <div 
                      className="absolute -inset-2 rounded-full border-2 border-muted/30"
                    />
                    {/* Progress Circle */}
                    <svg
                      className="absolute -inset-2 h-[calc(100%+16px)] w-[calc(100%+16px)] -rotate-90"
                      viewBox="0 0 32 32"
                    >
                      <circle
                        className="stroke-primary transition-all duration-100"
                        cx="16"
                        cy="16"
                        r="14"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray={`${2 * Math.PI * 14}`}
                        strokeDashoffset={`${2 * Math.PI * 14 * (1 - volume)}`}
                      />
                    </svg>
                  </>
                )}
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </div>
            </Button>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center gap-4">
            {/* Previous Part Number */}
            <span className="text-xs text-muted-foreground">
              {currentItem && currentItem.currentSegment > 0
                ? `Part ${currentItem.currentSegment}`
                : ''}
            </span>

            {/* Previous Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={!currentItem || currentItem.currentSegment === 0}
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            {/* Play/Pause Button */}
            <PlayButton />

            {/* Next Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={!currentItem || currentItem.currentSegment === currentItem.totalSegments - 1}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Next Part Number */}
            <span className="text-xs text-muted-foreground">
              {currentItem && currentItem.currentSegment < currentItem.totalSegments - 1
                ? `Part ${currentItem.currentSegment + 2}`
                : ''}
            </span>
          </div>
        </div>

        {/* Source Display */}
        {currentItem?.source && (
          <div className="text-center mt-2">
            <p className="text-xs text-muted-foreground">
              Source:{' '}
              {currentItem.source.startsWith('http') ? (
                <a
                  href={currentItem.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {new URL(currentItem.source).hostname}
                </a>
              ) : (
                currentItem.source
              )}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
