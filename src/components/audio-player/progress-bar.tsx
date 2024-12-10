import React, { useEffect, useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';
import { useAudioQueue } from '@/lib/store/audio-queue';
import { toneManager } from '@/lib/utils/tone-manager';

// Define the props interface
interface ProgressBarProps {
  onSeek: (segmentIndex: number) => Promise<void>; // Add the onSeek prop
}

export function ProgressBar({ onSeek }: ProgressBarProps) { // Accept the onSeek prop
  const { isPlaying, queue, currentIndex } = useAudioQueue();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentItem = currentIndex !== null ? queue[currentIndex] : null;

  const updateProgress = useCallback(() => {
    if (!currentItem) return;

    const currentSegment = currentItem.segments[currentItem.currentSegment];
    if (!currentSegment) return;

    const currentTime = toneManager.getCurrentTime();
    const segmentDuration = toneManager.getDuration();

    if (segmentDuration > 0) {
      // Calculate segment progress
      const segmentProgress = (currentTime / segmentDuration) * 100;

      // Calculate overall progress considering all segments
      const overallProgress = (
        (currentItem.currentSegment * 100 + segmentProgress) /
        currentItem.totalSegments
      );

      setProgress(overallProgress);
      setDuration(segmentDuration);
    }
  }, [currentItem]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPlaying && currentItem) {
      // Update immediately when playback starts
      updateProgress();
      // Then update regularly
      interval = setInterval(updateProgress, 50);
    } else if (interval) {
      clearInterval(interval);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentItem, updateProgress]);

  const handleSeek = (value: number[]) => {
    if (!currentItem) return;

    const targetProgress = value[0];
    const targetSegmentIndex = Math.floor((targetProgress * currentItem.totalSegments) / 100);
    const segmentProgress = (targetProgress * currentItem.totalSegments) % 100;

    // Call the onSeek function with the segment index
    onSeek(targetSegmentIndex);
  };

  if (!currentItem) return null

  return (
    <div className="w-full px-2">
      <Slider
        defaultValue={[0]}
        value={[progress]}
        max={100}
        step={0.1}
        onValueChange={handleSeek}
        className="w-full"
      />
    </div>
  )
}
