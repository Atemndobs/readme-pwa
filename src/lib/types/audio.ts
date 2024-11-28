import { VoiceId } from '../store/settings'
import { TextSegment } from '../utils/text-segmentation'

export const AudioSegmentStatuses = {
  PENDING: 'pending',
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
  CANCELLED: 'cancelled'
} as const

export const QueueItemStatuses = {
  PENDING: 'pending',
  LOADING: 'loading',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error',
  PARTIAL: 'partial',
  CONVERTING: 'converting'
} as const

export type AudioSegmentStatus = typeof AudioSegmentStatuses[keyof typeof AudioSegmentStatuses]
export type QueueItemStatus = typeof QueueItemStatuses[keyof typeof QueueItemStatuses]

export interface AudioSegment extends TextSegment {
  id: string
  audioUrl: string | null
  audio: HTMLAudioElement | null
  status: AudioSegmentStatus
  error?: string
}

export interface QueueItem {
  id: string
  text: string
  voice: VoiceId
  source?: string
  imageUrl?: string
  segments: AudioSegment[]
  status: QueueItemStatus
  error: string | null
  currentSegment: number
  totalSegments: number
}
