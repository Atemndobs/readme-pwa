'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { Loader2, Play, Pause, SkipBack, SkipForward, X, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
    cancelConversion 
  } = useAudioQueue()

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
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {isConverting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <p className="text-sm">Converting text to speech...</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium truncate">
                  {currentItem?.segments[currentItem.currentSegment]?.text || 'No audio in queue'}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePrevious}
                    disabled={!currentItem}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      isPlaying && "text-blue-600 dark:text-blue-400"
                    )}
                    onClick={handlePlay}
                    disabled={!currentItem}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNext}
                    disabled={!currentItem}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-1">
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
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-gray-100"
              onClick={handleClearQueue}
              disabled={!hasItems}
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
