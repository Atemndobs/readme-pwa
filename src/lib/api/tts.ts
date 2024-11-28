import { VoiceId } from '../store/settings'
import { segmentText } from '../utils/text-segmentation'

const TTS_API_URL = 'http://45.94.111.107:6080/v1/audio/speech'

export class TTSError extends Error {
  constructor(message: string) {
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

export async function convertTextToSpeech(text: string, voice: VoiceId, signal?: AbortSignal): Promise<TTSSegment[]> {
  try {
    const segments = segmentText(text);
    const audioSegments: TTSSegment[] = [];

    for (const segment of segments) {
      try {
        console.log('Converting segment with voice:', { text: segment.text, voice });
        
        // Extract voice name from the model ID (e.g., 'amy' from 'voice-en-us-amy-low')
        const voiceName = voice.split('-')[3];
        
        const response = await fetch(TTS_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: voice,
            input: segment.text,
            voice: voiceName
          }),
          signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('TTS API Error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            request: {
              text: segment.text,
              voice,
            },
          });
          throw new TTSError(`Failed to convert text: ${response.statusText} (${errorText})`);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          throw new TTSError('Received empty audio data from TTS service');
        }

        audioSegments.push({
          ...segment,
          audio: blob
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new TTSError('Conversion cancelled');
          }
          throw new TTSError(error.message);
        }
        throw new TTSError('Failed to convert text to speech');
      }
    }

    return audioSegments;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new TTSError('Conversion cancelled');
      }
      throw new TTSError(error.message);
    }
    throw new TTSError('Failed to convert text to speech');
  }
}

export function createAudioFromBlob(blob: Blob): HTMLAudioElement {
  const audio = new Audio();
  audio.src = URL.createObjectURL(blob);
  return audio;
}

export function createAudioQueue(segments: TTSSegment[]): { audio: HTMLAudioElement, segment: TTSSegment }[] {
  return segments
    .filter(segment => segment.audio)
    .map(segment => ({
      audio: createAudioFromBlob(segment.audio!),
      segment
    }));
}

export function playAudioQueue(audioElements: { audio: HTMLAudioElement, segment: TTSSegment }[]): Promise<void> {
  return new Promise((resolve, reject) => {
    let currentIndex = 0;

    const playNext = () => {
      if (currentIndex >= audioElements.length) {
        resolve();
        return;
      }

      const { audio, segment } = audioElements[currentIndex];
      currentIndex++;

      // Add a small pause between segments based on their type
      const getPauseTime = () => {
        switch (segment.type) {
          case 'heading': return 1000; // 1 second after headings
          case 'paragraph': return 800; // 0.8 seconds after paragraphs
          case 'list': return 400; // 0.4 seconds after list items
          default: return 200; // 0.2 seconds after other segments
        }
      };

      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audio.src); // Clean up the blob URL
        setTimeout(playNext, getPauseTime());
      });

      audio.addEventListener('error', (e) => {
        reject(new Error('Error playing audio segment'));
      });

      audio.play().catch(reject);
    };

    playNext();
  });
}
