import React from 'react'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

interface ProgressBarProps {
  onSeek: (segmentIndex: number) => void
}

export function ProgressBar({ onSeek }: ProgressBarProps) {
  const { queue, currentIndex } = useAudioQueue()
  const currentItem = currentIndex !== null ? queue[currentIndex] : null
  const hasItems = queue.length > 0

  const totalSegments = currentItem?.totalSegments ?? 1
  const currentSegment = currentItem?.currentSegment ?? 0

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
          disabled={!hasItems}
        />
        
        {/* Segment markers */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 pointer-events-none">
          {Array.from({ length: totalSegments }).map((_, index) => (
            <div
              key={index}
              onClick={() => handleMarkerClick(index)}
              className={`absolute -translate-x-1/2 -translate-y-3 w-2 h-2 rounded-full ${
                !hasItems ? 'bg-muted cursor-not-allowed' :
                index === currentSegment ? 'bg-primary cursor-pointer pointer-events-auto' : 
                'bg-muted hover:bg-primary/50 cursor-pointer pointer-events-auto'
              }`}
              style={{
                left: `${(index / (totalSegments - 1)) * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Progress info */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Part {currentSegment + 1} of {totalSegments}</span>
        <span>{currentItem?.segments[currentSegment]?.type || 'Text'}</span>
      </div>
    </div>
  )
}
