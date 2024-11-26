'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ProgressBar } from './progress-bar'

export function MiniPlayer() {
  const { queue, currentIndex, isPlaying, play, pause, next, previous, remove, clear } = useAudioQueue()

  const currentItem = currentIndex !== null ? queue[currentIndex] : null
  const hasItems = queue.length > 0

  // Don't show the player if there are no items
  if (!hasItems) return null

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

  const handleRemoveCurrent = () => {
    if (currentItem) {
      remove(currentItem.id)
      toast.success('Removed from queue')
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
            <p className="text-sm font-medium truncate">
              {currentItem?.segments[currentItem.currentSegment]?.text || 'No track selected'}
            </p>
            <p className="text-xs text-muted-foreground">
              Part {(currentItem?.currentSegment ?? 0) + 1} of {currentItem?.totalSegments ?? 0}
              {queue.length > 1 && ` • ${queue.length} items in queue`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2"
            onClick={handleClearQueue}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <ProgressBar onSeek={async (segmentIndex) => {
          if (currentItem) {
            try {
              // Update current segment and play from there
              await play(currentItem.id, segmentIndex)
            } catch (error) {
              console.error('Seek error:', error)
              toast.error('Failed to seek to position')
            }
          }
        }} />

        <div className="flex items-center justify-center space-x-2">
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
              <SkipBackIcon className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="default"
            size="icon"
            onClick={handlePlay}
            disabled={!currentItem}
          >
            {isPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
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
              <SkipForwardIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {currentItem?.error && (
          <p className="text-xs text-destructive text-center">
            {currentItem.error}
          </p>
        )}
      </div>
    </Card>
  )
}
