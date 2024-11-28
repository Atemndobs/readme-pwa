import { NextRequest, NextResponse } from 'next/server';

const TTS_API_URL = 'https://voice.cloud.atemkeng.de/audio/speech';

export async function POST(request: NextRequest) {
  // Handle CORS preflight request
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const body = await request.json();
    console.log('TTS API Request:', { body });

    // Flexible input parsing
    const model = body.model || body.voice;
    const input = body.input || body.text;
    const voiceName = body.voice || (model ? model.split('-')[3] : undefined);

    // Validate inputs
    if (!model || !input || !voiceName) {
      console.error('Invalid request body:', body);
      return NextResponse.json(
        { error: 'Missing required parameters: model/voice, input/text' },
        { 
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Prepare request to TTS service
    const ttsResponse = await fetch(TTS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        input: input,
        voice: voiceName
      }),
    });

    // Check TTS service response
    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('TTS service error:', errorText);
      return NextResponse.json(
        { error: `Failed to convert text to speech: ${errorText}` },
        { 
          status: ttsResponse.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Process the audio response
    const arrayBuffer = await ttsResponse.arrayBuffer();
    
    if (arrayBuffer.byteLength === 0) {
      console.error('Empty response from TTS API');
      return NextResponse.json(
        { error: 'Received empty response from TTS service' },
        { 
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Return the audio response
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('TTS API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process text-to-speech request' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}
