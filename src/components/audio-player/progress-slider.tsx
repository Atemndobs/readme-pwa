import * as React from 'react'
import * as Slider from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'

interface ProgressSliderProps {
  currentTime: number
  duration: number
  onSeek: (value: number) => void
  className?: string
  showTime?: boolean
  disabled?: boolean
}

export function ProgressSlider({
  currentTime,
  duration,
  onSeek,
  className,
  showTime = true,
  disabled = false,
}: ProgressSliderProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(currentTime)
  const progressPercentage = React.useMemo(
    () => (duration > 0 ? (currentTime / duration) * 100 : 0),
    [currentTime, duration]
  )

  // Update local value when not dragging
  React.useEffect(() => {
    if (!isDragging) {
      setLocalValue(currentTime)
    }
  }, [currentTime, isDragging])

  const handleValueChange = React.useCallback(
    (values: number[]) => {
      const newValue = values[0]
      setLocalValue(newValue)
      if (!isDragging) {
        onSeek(newValue)
      }
    },
    [isDragging, onSeek]
  )

  const handleDragStart = React.useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleDragEnd = React.useCallback(() => {
    setIsDragging(false)
    onSeek(localValue)
  }, [localValue, onSeek])

  return (
    <div className={cn('flex flex-col gap-1 w-full', className)}>
      {showTime && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(localValue)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}
      <Slider.Root
        className="relative flex items-center select-none touch-none h-10 group"
        value={[localValue]}
        max={duration || 100}
        step={0.1}
        aria-label="Audio Progress"
        onValueChange={handleValueChange}
        onPointerDown={handleDragStart}
        onPointerUp={handleDragEnd}
        disabled={disabled || duration === 0}
      >
        <Slider.Track className="bg-secondary relative grow rounded-full h-1 group-hover:h-1.5 transition-all">
          <Slider.Range className="absolute bg-primary rounded-full h-full transition-all" />
        </Slider.Track>
        <Slider.Thumb
          className={cn(
            'block w-3 h-3 bg-primary rounded-full opacity-0',
            'hover:opacity-100 focus-visible:opacity-100',
            'group-hover:opacity-100 transition-opacity',
            'focus:outline-none focus-visible:ring-2',
            'focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
        />
      </Slider.Root>
    </div>
  )
}
