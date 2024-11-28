import { VoiceId } from '../store/settings'
import { segmentText } from '../utils/text-segmentation'

const TTS_API_URL = 'https://voice.cloud.atemkeng.de/audio/speech'

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

export async function convertTextToSpeech(
  text: string, 
  voice: VoiceId
): Promise<Blob> {
  try {
    const voiceName = voice.split('-')[3];
    
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: voice,
        input: text,
        voice: voiceName
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new TTSError(`Failed to convert text to speech: ${errorText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('Text-to-Speech conversion error:', error);
    throw new TTSError(
      error instanceof Error 
        ? error.message 
        : 'Unknown error during text-to-speech conversion'
    );
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
