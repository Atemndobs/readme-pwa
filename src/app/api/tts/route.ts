import { NextRequest, NextResponse } from 'next/server';

const TTS_API_URL = 'http://45.94.111.107:6080/v1/audio/speech';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('TTS API Request:', { body });

    // Ensure we have a valid voice model ID
    if (!body.voice?.match(/^voice-[a-z]{2}(-[a-z]{2})?-[a-z]+-low$/)) {
      console.error('Invalid voice format:', body.voice);
      return NextResponse.json(
        { error: 'Invalid voice model format' },
        { status: 400 }
      );
    }

    // Extract voice name from the model ID (e.g., 'amy' from 'voice-en-us-amy-low')
    const voiceName = body.voice.split('-')[3];

    const response = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: body.voice, // Use the full model ID
        input: body.text, // Text to convert
        voice: voiceName // Just the voice name
      }),
    });

    console.log('TTS API Response Status:', response.status);
    console.log('TTS API Response Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      return NextResponse.json(
        { error: `Failed to convert text to speech: ${response.statusText}` },
        { status: response.status }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    console.log('Response Size:', arrayBuffer.byteLength);

    if (arrayBuffer.byteLength === 0) {
      console.error('Empty response from TTS API');
      return NextResponse.json(
        { error: 'Received empty response from TTS service' },
        { status: 500 }
      );
    }

    // Create a new Response with the audio data
    const audioResponse = new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
      },
    });

    console.log('Sending Audio Response:', {
      size: arrayBuffer.byteLength,
      headers: Object.fromEntries(audioResponse.headers.entries())
    });

    return audioResponse;
  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process text-to-speech request' },
      { status: 500 }
    );
  }
}
