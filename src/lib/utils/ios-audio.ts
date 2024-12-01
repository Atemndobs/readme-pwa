// iOS audio handling utilities
let hasUserInteraction = false;
let audioContext: AudioContext | null = null;

export const setUserInteraction = (value: boolean) => {
  console.log('[iOS Audio] Setting user interaction:', value);
  hasUserInteraction = value;
};

export const getUserInteraction = () => hasUserInteraction;

// Initialize audio for iOS
export const initializeIOSAudio = async () => {
  console.log('[iOS Audio] Initializing audio...');
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      console.log('[iOS Audio] Creating new AudioContext');
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    console.log('[iOS Audio] AudioContext state:', audioContext.state);

    // Resume audio context if it's suspended
    if (audioContext.state === 'suspended') {
      console.log('[iOS Audio] Resuming suspended AudioContext');
      try {
        await audioContext.resume();
        console.log('[iOS Audio] AudioContext resumed successfully');
      } catch (e) {
        console.error('[iOS Audio] Failed to resume AudioContext:', e);
      }
    }

    // Create a buffer source for a short sound
    const buffer = audioContext.createBuffer(1, 1024, audioContext.sampleRate);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Create and configure gain node
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0.001; // Very low volume instead of 0
    
    // Connect nodes
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    console.log('[iOS Audio] Starting buffer source');
    source.start(0);
    
    // Create a silent audio element with all iOS-specific attributes
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'; // 1ms silence
    audio.preload = 'auto';
    audio.loop = false;
    audio.volume = 0.001; // Very low volume instead of 0
    audio.muted = false; // Changed from true
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('x-webkit-airplay', 'allow');
    
    console.log('[iOS Audio] Attempting to play silent audio');
    try {
      await Promise.race([
        audio.play(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Audio play timeout')), 2000))
      ]);
      console.log('[iOS Audio] Silent audio played successfully');
      audio.pause();
      setUserInteraction(true);
      return audioContext;
    } catch (e) {
      console.log('[iOS Audio] Silent audio play failed:', e);
      return null;
    }
  } catch (error) {
    console.error('[iOS Audio] Initialization failed:', error);
    return null;
  }
};

// Handle iOS audio initialization
export const handleIOSAudioInit = async () => {
  console.log('[iOS Audio] handleIOSAudioInit called, current state:', {
    hasUserInteraction,
    audioContextState: audioContext?.state
  });

  try {
    if (!hasUserInteraction || (audioContext?.state === 'suspended')) {
      console.log('[iOS Audio] Attempting initialization');
      const context = await initializeIOSAudio();
      if (context) {
        console.log('[iOS Audio] Initialization successful');
        setUserInteraction(true);
        return true;
      }
      console.log('[iOS Audio] Initialization failed');
      return false;
    }
    
    // If we already have user interaction and active context, just verify state
    if (audioContext?.state === 'running') {
      console.log('[iOS Audio] AudioContext already running');
      return true;
    }

    return hasUserInteraction;
  } catch (error) {
    console.error('[iOS Audio] Initialization error:', error);
    return false;
  }
};
