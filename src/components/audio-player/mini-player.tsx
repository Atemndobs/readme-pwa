'use client'

import React from 'react'
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

  const currentItem = currentIndex !== null ? queue[currentIndex] : null
  const hasItems = queue.length > 0

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
        <div className="flex items-center justify-between">
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
              <>
                <p className="text-sm font-medium truncate">
                  {currentItem?.segments[currentItem.currentSegment]?.text || 'No track selected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Part {(currentItem?.currentSegment ?? 0) + 1} of {currentItem?.totalSegments ?? 0}
                  {queue.length > 1 && ` • ${queue.length} items in queue`}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center">
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

        <div className="flex items-center justify-center space-x-2">
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
          {/* Previous button with segment info */}
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">
              {currentItem && currentItem.currentSegment > 0
                ? `Part ${currentItem.currentSegment}`
                : ''}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={!currentItem || currentItem.currentSegment === 0}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
          </div>

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

          {/* Next button with segment info */}
          <div className="flex flex-col items-center">
            <span className="text-xs text-muted-foreground mb-1">
              {currentItem && currentItem.currentSegment < currentItem.totalSegments - 1
                ? `Part ${currentItem.currentSegment + 2}`
                : ''}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              disabled={!currentItem || currentItem.currentSegment === currentItem.totalSegments - 1}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
