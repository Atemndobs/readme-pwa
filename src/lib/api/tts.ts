import { VoiceId } from '../store/settings'
import { segmentText } from '../utils/text-segmentation'

const TTS_API_URL = '/api/tts'

export class TTSError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'TTSError';
  }
}

interface TTSSegment {
  text: string;
  type: 'heading' | 'paragraph' | 'list' | 'quote' | 'text';
  level?: number;
  audio?: Blob;
}

export async function convertTextToSpeech(text: string, voice: VoiceId): Promise<TTSSegment[]> {
  const segments = segmentText(text);
  const audioSegments: TTSSegment[] = [];

  for (const segment of segments) {
    try {
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: segment.text,
          voice,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to convert text to speech';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          // Use default error message if parsing fails
        }
        throw new TTSError(errorMessage, response.status);
      }

      const blob = await response.blob();
      audioSegments.push({
        ...segment,
        audio: blob
      });
    } catch (error) {
      if (error instanceof TTSError) {
        throw error;
      }
      throw new TTSError('Failed to convert text to speech');
    }
  }

  return audioSegments;
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
