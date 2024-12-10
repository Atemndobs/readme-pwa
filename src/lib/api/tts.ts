import { VoiceId } from '../store/settings'
import { segmentText } from '../utils/text-segmentation'
import * as Sentry from '@sentry/nextjs';
import { SpanStatus, SPAN_STATUS_OK, SPAN_STATUS_ERROR } from '@sentry/core';

const TTS_API_URL = '/api/tts'
const MAX_RETRIES = 3
const RETRY_DELAY_BASE = 1000 // Base delay in milliseconds

export class TTSError extends Error {
  constructor(message: string, public readonly retryable: boolean = true) {
    super(message)
    this.name = 'TTSError'
  }
}

interface TTSSegment {
  text: string;
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'text';
  level?: number;
  audio?: Blob;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries + 1; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If response is 404, don't retry
      if (response.status === 404) {
        throw new TTSError(`Resource not found: ${url}`, false);
      }
      
      // If response is successful, return it
      if (response.ok) {
        return response;
      }
      
      // For 5xx errors, retry if we have retries left
      if (response.status >= 500 && attempt < retries) {
        const delayTime = RETRY_DELAY_BASE * Math.pow(2, attempt);
        console.log(`[TTS] Server error (${response.status}), retrying after ${delayTime}ms, ${retries - attempt} retries left`);
        await delay(delayTime);
        continue;
      }
      
      throw new TTSError(
        `Failed to convert text (${response.status}): ${response.statusText}`,
        response.status >= 500
      );
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      
      if (error instanceof Error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          throw new TTSError('Conversion cancelled', false);
        }
        
        // Network errors are retryable
        if (attempt < retries) {
          const delayTime = RETRY_DELAY_BASE * Math.pow(2, attempt);
          console.log(`[TTS] Network error, retrying after ${delayTime}ms, ${retries - attempt} retries left: ${error.message}`);
          await delay(delayTime);
          continue;
        }
      }
    }
  }
  
  throw new TTSError(`Network error after ${retries} retries: ${lastError?.message}`, true);
}

export async function convertTextToSpeech(
  text: string,
  voice: VoiceId,
  signal?: AbortSignal
): Promise<TTSSegment[]> {
  const segments = segmentText(text);
  const audioSegments: TTSSegment[] = [];
  
  // Create a span for this conversion
  return Sentry.startSpan(
    {
      name: 'tts.convert',
      op: 'tts',
      attributes: {
        textLength: text.length,
        segmentsCount: segments.length,
        voice,
      },
      forceTransaction: true, // This ensures it shows up as a transaction in the Sentry UI
    },
    async (span) => {
      try {
        for (const segment of segments) {
          try {
            console.log(`[TTS] Converting segment: ${segment.text.substring(0, 50)}...`);
            
            const response = await fetchWithRetry(
              TTS_API_URL,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  text: segment.text,
                  voice,
                }),
                signal,
              },
              MAX_RETRIES
            );
            
            const blob = await response.blob();
            audioSegments.push({ ...segment, audio: blob });
          } catch (error) {
            if (error instanceof TTSError) {
              throw error;
            }
            throw new TTSError(`Failed to convert segment: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        span.setStatus({ code: SPAN_STATUS_OK });
        return audioSegments;
      } catch (error) {
        span.setStatus({ code: SPAN_STATUS_ERROR });
        // Add error details to the span
        span.setAttribute('error.message', error instanceof Error ? error.message : String(error));
        span.setAttribute('error.type', error instanceof TTSError ? 'TTSError' : 'UnknownError');
        throw error;
      } finally {
        // span.finish();
      }
    }
  );
}

// Helper function to create an audio element from a blob
export function createAudioFromBlob(blob: Blob): HTMLAudioElement {
  const audio = new Audio();
  audio.src = URL.createObjectURL(blob);
  return audio;
}

// Helper function to create an audio queue from segments
export function createAudioQueue(
  segments: TTSSegment[]
): { audio: HTMLAudioElement; segment: TTSSegment }[] {
  return segments
    .filter(segment => segment.audio)
    .map(segment => ({
      audio: createAudioFromBlob(segment.audio!),
      segment
    }));
}

// Helper function to play a queue of audio elements
export async function playAudioQueue(
  audioElements: { audio: HTMLAudioElement; segment: TTSSegment }[]
): Promise<void> {
  for (const { audio } of audioElements) {
    try {
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('Audio playback failed'));
        audio.play().catch(reject);
      });
    } finally {
      URL.revokeObjectURL(audio.src);
    }
  }
}
