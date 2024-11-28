'use client'

import React, { useEffect, useState } from 'react'
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
import { ProgressBar } from './progress-bar'
import { Slider } from '@/components/ui/slider'

export function MiniPlayer() {
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
    toggleMute
  } = useAudioQueue()

  const [showVolumeSlider, setShowVolumeSlider] = React.useState(false)
  const [audioVisual, setAudioVisual] = React.useState<{ url: string | null; background: string }>({
    url: null,
    background: 'linear-gradient(45deg, hsl(230, 70%, 50%), hsl(200, 70%, 50%))'
  })

  const currentItem = currentIndex !== null ? queue[currentIndex] : null
  const hasItems = queue.length > 0

  // Update audio visual when current item changes
  useEffect(() => {
    if (currentItem) {
      getAudioImage(currentItem.text, currentItem.voice).then(setAudioVisual)
    }
  }, [currentItem?.id])

  // Hide player if no items and not converting
  if (!hasItems && !isConverting) {
    return null
  }

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        pause()
      } else {
        await play()
      }
    } catch (error) {
      console.error('Playback error:', error)
      toast.error('Failed to play audio')
    }
  }

  const handleNext = async () => {
    try {
      await next()
    } catch (error) {
      console.error('Next track error:', error)
      toast.error('Failed to play next track')
    }
  }

  const handlePrevious = async () => {
    try {
      await previous()
    } catch (error) {
      console.error('Previous track error:', error)
      toast.error('Failed to play previous track')
    }
  }

  const handleClearQueue = () => {
    clear()
    toast.success('Queue cleared')
  }

  return (
    <Card className="w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              <img 
                src={audioVisual.url} 
                alt="Audio cover" 
                className="object-cover w-full h-full transition-opacity duration-200"
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
                  toast.success('Conversion cancelled')
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
            segments: currentItem?.segments
          })
          
          // Show progress bar when playing or paused
          return currentItem && ['playing', 'paused'].includes(currentItem.status) && (
            <div className="space-y-2">
              <ProgressBar onSeek={async (segmentIndex) => {
                try {
                  await play(currentItem.id, segmentIndex)
                } catch (error) {
                  console.error('Seek error:', error)
                  toast.error('Failed to seek to position')
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
              className="h-8 w-8"
              onClick={toggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            {showVolumeSlider && (
              <div 
                className="absolute bottom-full right-0 mb-2 p-2 bg-background border rounded-md shadow-lg w-32"
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <Slider
                  defaultValue={[volume]}
                  max={1}
                  step={0.01}
                  value={[volume]}
                  onValueChange={(value) => setVolume(value[0])}
                  className="w-full"
                />
              </div>
            )}
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
            <Button
              variant="default"
              size="icon"
              onClick={handlePlay}
              disabled={!currentItem}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

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
