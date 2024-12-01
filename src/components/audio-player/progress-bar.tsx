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
  const currentSegmentAudio = currentItem.segments[currentSegment]?.audio

  const handleSeek = (value: number[]) => {
    console.log('[PROGRESS_BAR] Seeking to:', {
      value,
      segmentIndex: Math.floor(value[0])
    });
    onSeek(Math.floor(value[0]))
  }

  const handleMarkerClick = (index: number) => {
    console.log('[PROGRESS_BAR] Marker clicked:', {
      currentIndex: index,
      totalSegments,
      currentSegment,
      hasAudio: !!currentItem?.segments[index]?.audio
    })
    
    if (currentItem?.segments[index]?.audio) {
      onSeek(index)
    }
  }

  // Format time in MM:SS format
  const formatTime = (time: number) => {
    console.log('[PROGRESS_BAR] Formatting time:', {
      input: time,
      isValid: !isNaN(time) && time !== null
    });
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Calculate total elapsed time across all segments
  const calculateTotalElapsed = () => {
    if (!currentItem) return 0;
    let elapsed = 0;
    
    // Add duration of completed segments
    for (let i = 0; i < currentSegment; i++) {
      const segment = currentItem.segments[i];
      if (segment.audio?.duration) {
        elapsed += segment.audio.duration;
      }
    }
    
    // Add current segment's elapsed time
    if (currentSegmentAudio && currentTime) {
      elapsed += currentTime;
    }
    
    return elapsed;
  };

  // Calculate total duration of all segments
  const calculateTotalDuration = () => {
    if (!currentItem) return 0;
    return currentItem.segments.reduce((total, segment) => {
      return total + (segment.audio?.duration || 0);
    }, 0);
  };

  // Calculate overall progress for the slider
  const calculateProgress = () => {
    const totalDuration = calculateTotalDuration();
    const totalElapsed = calculateTotalElapsed();
    
    console.log('[PROGRESS_BAR] Progress calculation:', {
      currentTime,
      duration,
      currentSegment: currentSegment + 1,
      totalSegments,
      totalElapsed,
      totalDuration,
      segments: currentItem?.segments.map(s => ({
        duration: s.audio?.duration,
        status: s.status
      }))
    });

    // Calculate progress based on total elapsed time across all segments
    const progress = totalDuration > 0 ? (totalElapsed / totalDuration) * 100 : 0;
    return Math.min(100, Math.max(0, progress));
  };

  return (
    <div className="w-full space-y-2">
      <div className="relative">
        {/* Main slider */}
        <Slider
          min={0}
          max={100}
          step={0.1}
          value={[calculateProgress()]}
          onValueChange={value => {
            if (!currentItem || !currentItem.segments[currentSegment]?.audio) return;
            
            const audio = currentItem.segments[currentSegment].audio!;
            const targetTime = (value[0] / 100) * audio.duration;
            
            console.log('[PROGRESS_BAR] Seeking:', { 
              targetTime, 
              percentage: value[0],
              currentSegment,
              duration: audio.duration
            });
            
            audio.currentTime = targetTime;
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
          <span>{formatTime(calculateTotalElapsed())}</span>
          <span>Part {currentSegment + 1} of {totalSegments}</span>
        </div>
        <div className="flex gap-4">
          <span>{currentItem.segments[currentSegment]?.type || 'Text'}</span>
          <span>-{formatTime(calculateTotalDuration() - calculateTotalElapsed())}</span>
        </div>
      </div>
    </div>
  )
}
