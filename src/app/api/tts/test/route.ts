import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Create a simple sine wave audio buffer
    const sampleRate = 44100;
    const duration = 2; // seconds
    const frequency = 440; // Hz (A4 note)
    
    const audioContext = new (globalThis.AudioContext || (globalThis as any).webkitAudioContext)();
    const samples = sampleRate * duration;
    const buffer = audioContext.createBuffer(1, samples, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < samples; i++) {
      channelData[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate);
    }
    
    // Convert to WAV format
    const wavData = audioBufferToWav(buffer);
    
    return new NextResponse(wavData, {
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('Test TTS API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate test audio' },
      { status: 500 }
    );
  }
}

// Helper function to convert AudioBuffer to WAV format
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  const offset = 44;
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset + i * bytesPerSample, sample * 0x7FFF, true);
  }
  
  return arrayBuffer;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
