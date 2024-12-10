import React, { useEffect, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { toneManager } from '@/lib/utils/tone-manager'

export function ProgressBar() {
  const { isPlaying } = useAudioQueue()
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    let animationFrame: number

    const updateProgress = () => {
      if (isPlaying) {
        const currentTime = toneManager.getCurrentTime()
        const duration = toneManager.getDuration()
        
        if (duration > 0) {
          setProgress((currentTime / duration) * 100)
          setDuration(duration)
        }
        
        animationFrame = requestAnimationFrame(updateProgress)
      }
    }

    if (isPlaying) {
      animationFrame = requestAnimationFrame(updateProgress)
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
      }
    }
  }, [isPlaying])

  const handleSeek = (value: number[]) => {
    const newTime = (value[0] / 100) * duration
    toneManager.seek(newTime)
  }

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
