// iOS audio handling utilities
let hasUserInteraction = false;
let audioContext: AudioContext | null = null;
let unlockAttempts = 0;
const MAX_UNLOCK_ATTEMPTS = 3;

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
      console.log('[iOS Audio] Attempting to resume suspended AudioContext');
      try {
        // Create and play a silent buffer to unlock audio
        const silentBuffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = silentBuffer;
        source.connect(audioContext.destination);
        source.start();
        
        await audioContext.resume();
        console.log('[iOS Audio] AudioContext resumed successfully');
        unlockAttempts = 0;
        return true;
      } catch (e) {
        console.error('[iOS Audio] Failed to resume AudioContext:', e);
        unlockAttempts++;
        if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
          throw new Error('iOS requires user interaction');
        }
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[iOS Audio] Initialization error:', error);
    throw error;
  }
};

// Handle iOS audio initialization
export const handleIOSAudioInit = async () => {
  try {
    if (!hasUserInteraction) {
      console.log('[iOS Audio] No user interaction yet');
      return false;
    }

    const success = await initializeIOSAudio();
    return success;
  } catch (error) {
    console.error('[iOS Audio] Init error:', error);
    return false;
  }
};
