import React from 'react'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { Slider } from '@/components/ui/slider'

interface ProgressBarProps {
  onSeek: (segmentIndex: number) => void
}

export function ProgressBar({ onSeek }: ProgressBarProps) {
  const { queue, currentIndex } = useAudioQueue()
  const currentItem = currentIndex !== null ? queue[currentIndex] : null

  console.log('ProgressBar Component Debug:', {
    hasQueue: queue.length > 0,
    currentIndex,
    hasCurrentItem: !!currentItem,
    status: currentItem?.status,
    totalSegments: currentItem?.totalSegments,
    currentSegment: currentItem?.currentSegment
  })

  // Show progress bar for playing and paused states
  if (!currentItem || !['playing', 'paused'].includes(currentItem.status)) {
    console.log('ProgressBar early return:', {
      reason: !currentItem ? 'no current item' : 'status not playable',
      status: currentItem?.status
    })
    return null
  }

  const totalSegments = currentItem.totalSegments
  const currentSegment = currentItem.currentSegment

  const handleSeek = (value: number[]) => {
    onSeek(Math.floor(value[0]))
  }

  const handleMarkerClick = (index: number) => {
    onSeek(index)
  }

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {/* Main slider */}
        <Slider
          defaultValue={[currentSegment]}
          max={totalSegments - 1}
          step={1}
          value={[currentSegment]}
          onValueChange={handleSeek}
          className="w-full"
        />
        
        {/* Segment markers */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none">
          {Array.from({ length: totalSegments }).map((_, index) => (
            <div
              key={index}
              onClick={() => handleMarkerClick(index)}
              className={`absolute -translate-x-1/2 -translate-y-3 w-2 h-2 rounded-full cursor-pointer pointer-events-auto transition-colors ${
                index === currentSegment ? 'bg-primary' : 'bg-muted hover:bg-primary/50'
              }`}
              style={{
                left: `${(index / (totalSegments - 1)) * 100}%`,
              }}
              role="button"
              tabIndex={0}
              aria-label={`Go to segment ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Progress info */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Part {currentSegment + 1} of {totalSegments}</span>
        <span>{currentItem.segments[currentSegment]?.type || 'Text'}</span>
      </div>
    </div>
  )
}
