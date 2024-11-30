import React from 'react'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { Slider } from '@/components/ui/slider'

interface ProgressBarProps {
  onSeek: (segmentIndex: number) => void
}

export function ProgressBar({ onSeek }: ProgressBarProps) {
  const { queue, currentIndex, currentTime, duration } = useAudioQueue()
  const currentItem = currentIndex !== null ? queue[currentIndex] : null

  console.log('[PROGRESS_BAR] Component Debug:', {
    hasQueue: queue.length > 0,
    currentIndex,
    hasCurrentItem: !!currentItem,
    status: currentItem?.status,
    totalSegments: currentItem?.totalSegments,
    currentSegment: currentItem?.currentSegment,
    currentTime,
    duration,
    renderConditions: {
      hasCurrentItem: !!currentItem,
      hasValidStatus: currentItem && ['playing', 'paused', 'ready', 'partial'].includes(currentItem.status),
      hasAudioData: currentItem?.segments.some(s => (s.audio?.duration ?? 0) > 0),
      hasCurrentTime: !!currentTime,
      hasDuration: !!duration
    },
    segments: currentItem?.segments.map(s => ({
      type: s.type,
      duration: s.audio?.duration ?? 0,
      status: s.status,
      hasAudio: !!s.audio,
      text: s.text?.slice(0, 50) // first 50 chars
    }))
  })

  // Show progress bar for playing, paused, ready and partial states
  if (!currentItem || !['playing', 'paused', 'ready', 'partial'].includes(currentItem.status)) {
    console.log('[PROGRESS_BAR] Early return:', {
      reason: !currentItem ? 'no current item' : 'status not allowed',
      currentStatus: currentItem?.status,
      allowedStatuses: ['playing', 'paused', 'ready', 'partial'],
      currentTime,
      duration
    })
    return null
  }

  const totalSegments = currentItem.totalSegments
  const currentSegment = currentItem.currentSegment

  console.log('ProgressBar segment info:', {
    totalSegments,
    currentSegment,
    currentTime,
    duration,
    progress: (currentTime / duration) * 100
  })

  const handleSeek = (value: number[]) => {
    console.log('ProgressBar seek:', { value, currentTime, duration })
    onSeek(Math.floor(value[0]))
  }

  const handleMarkerClick = (index: number) => {
    onSeek(index)
  }

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate current segment elapsed time
  const calculateCurrentSegmentElapsed = () => {
    if (!currentItem) return 0
    const currentSegmentAudio = currentItem.segments[currentSegment]?.audio
    if (!currentSegmentAudio) return 0
    
    return currentTime || 0
  }

  // Calculate total remaining time across all segments
  const calculateTotalRemainingTime = () => {
    if (!currentItem) return 0
    let remainingTime = 0
    
    // Get current segment's remaining time
    const currentSegmentAudio = currentItem.segments[currentSegment]?.audio
    if (currentSegmentAudio) {
      remainingTime += Math.max(0, currentSegmentAudio.duration - (currentTime || 0))
    }
    
    // Add duration of remaining segments
    for (let i = currentSegment + 1; i < currentItem.segments.length; i++) {
      const segment = currentItem.segments[i]
      if (segment.audio) {
        remainingTime += segment.audio.duration
      }
    }
    
    console.log('Time calculation:', {
      currentSegment,
      currentTime,
      currentSegmentDuration: currentSegmentAudio?.duration,
      remainingTime,
      totalSegments: currentItem.segments.length
    })
    
    return remainingTime
  }

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {/* Main slider */}
        <Slider
          min={0}
          max={100}
          step={0.1}
          value={[currentItem.segments[currentSegment]?.audio ? 
            (currentTime / currentItem.segments[currentSegment].audio.duration) * 100 : 0
          ]}
          onValueChange={value => {
            const currentSegmentAudio = currentItem.segments[currentSegment]?.audio
            if (!currentSegmentAudio) return
            
            // Convert percentage back to time
            const targetTime = (value[0] / 100) * currentSegmentAudio.duration
            currentSegmentAudio.currentTime = targetTime
          }}
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
        <div className="flex gap-4">
          <span>{formatTime(calculateCurrentSegmentElapsed())}</span>
          <span>Part {currentSegment + 1} of {totalSegments}</span>
        </div>
        <div className="flex gap-4">
          <span>{currentItem.segments[currentSegment]?.type || 'Text'}</span>
          <span>-{formatTime(calculateTotalRemainingTime())}</span>
        </div>
      </div>
    </div>
  )
}
