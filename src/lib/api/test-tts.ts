export async function testTTSAPI(): Promise<void> {
  try {
    // Test the main TTS endpoint
    console.log('Testing main TTS endpoint...');
    const mainResponse = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: 'Hello, this is a test.',
        model: 'en-US-Neural2-H',
        voice: 'en-US-Neural2-H',
      }),
    });

    console.log('Main TTS Response:', {
      status: mainResponse.status,
      statusText: mainResponse.statusText,
      headers: Object.fromEntries(mainResponse.headers.entries()),
    });

    if (mainResponse.ok) {
      const blob = await mainResponse.blob();
      console.log('Main TTS Audio Blob:', {
        size: blob.size,
        type: blob.type,
      });
    } else {
      const error = await mainResponse.text();
      console.error('Main TTS Error:', error);
    }

    // Test the test endpoint
    console.log('Testing test endpoint...');
    const testResponse = await fetch('/api/tts/test');
    
    console.log('Test Endpoint Response:', {
      status: testResponse.status,
      statusText: testResponse.statusText,
      headers: Object.fromEntries(testResponse.headers.entries()),
    });

    if (testResponse.ok) {
      const blob = await testResponse.blob();
      console.log('Test Audio Blob:', {
        size: blob.size,
        type: blob.type,
      });

      // Try playing the test audio
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play().catch(console.error);
    } else {
      const error = await testResponse.text();
      console.error('Test Endpoint Error:', error);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}
