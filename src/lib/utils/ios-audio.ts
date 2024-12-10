// iOS audio handling utilities
let hasUserInteraction = false;
let audioContext: AudioContext | null = null;
let unlockAttempts = 0;
const MAX_UNLOCK_ATTEMPTS = 3;
const UNLOCK_RETRY_DELAY = 500; // ms

// Track the last interaction time
let lastInteractionTime = 0;
const INTERACTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export const setUserInteraction = (value: boolean) => {
  console.log('[iOS Audio] Setting user interaction:', value);
  hasUserInteraction = value;
  if (value) {
    lastInteractionTime = Date.now();
  }
};

export const getUserInteraction = () => {
  // Check if the last interaction has timed out
  if (hasUserInteraction && Date.now() - lastInteractionTime > INTERACTION_TIMEOUT) {
    console.log('[iOS Audio] User interaction timed out');
    hasUserInteraction = false;
    return false;
  }
  return hasUserInteraction;
};

// Initialize audio for iOS with retry mechanism
export const initializeIOSAudio = async () => {
  console.log('[iOS Audio] Initializing audio...');
  
  const tryInitialize = async (): Promise<boolean> => {
    try {
      if (!audioContext) {
        console.log('[iOS Audio] Creating new AudioContext');
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Create and configure oscillator for a silent ping
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.01; // Very low volume
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Only start if context is suspended
      if (audioContext.state === 'suspended') {
        oscillator.start(0);
        oscillator.stop(0.1); // Stop after 100ms
        await audioContext.resume();
        
        // Double-check the context state after a small delay
        await new Promise(resolve => setTimeout(resolve, 100));
        if (audioContext.state !== 'suspended') {
          console.log('[iOS Audio] AudioContext resumed successfully');
          setUserInteraction(true);
          unlockAttempts = 0;
          return true;
        } else if (audioContext.state === 'suspended') {
          console.warn('[iOS Audio] AudioContext is suspended.');
          // Handle suspended state if necessary
        } else if (audioContext.state === 'closed') {
          console.log('[iOS Audio] AudioContext is closed.');
          return false;
        } else {
          console.error(`Unexpected audio context state: ${audioContext.state}`);
        }
        throw new Error('AudioContext failed to resume');
      }
      
      return true;
    } catch (e) {
      console.error('[iOS Audio] Failed to initialize audio:', e);
      unlockAttempts++;
      
      if (unlockAttempts >= MAX_UNLOCK_ATTEMPTS) {
        console.error('[iOS Audio] Max unlock attempts reached');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, UNLOCK_RETRY_DELAY));
      return tryInitialize();
    }
  };

  return tryInitialize();
};

// Handle iOS audio initialization with user gesture
export const handleIOSAudioInit = async () => {
  if (!getUserInteraction()) {
    try {
      const success = await initializeIOSAudio();
      if (success) {
        return true;
      }
      // If initialization fails, we need new user interaction
      return false;
    } catch (e) {
      console.error('[iOS Audio] Failed to handle audio init:', e);
      return false;
    }
  }
  
  // Even if we have user interaction, ensure AudioContext is running
  if (audioContext?.state === 'suspended') {
    try {
      await audioContext.resume();
      return true;
    } catch (e) {
      console.error('[iOS Audio] Failed to resume AudioContext:', e);
      return false;
    }
  } else if (audioContext?.state === 'closed') {
    console.log('[iOS Audio] AudioContext is closed.');
    return false;
  } else if (audioContext?.state !== 'running') {
    console.error(`Unexpected audio context state: ${audioContext?.state}`);
    return false;
  }
  
  return true;
};

// Function to check if audio needs user interaction
export const needsUserInteraction = () => {
  return !getUserInteraction() || audioContext?.state === 'suspended' || audioContext?.state === 'closed';
};

// Clean up function for when the app is unmounted or user leaves
export const cleanupIOSAudio = () => {
  if (audioContext) {
    audioContext.close().catch(e => {
      console.error('[iOS Audio] Error closing AudioContext:', e);
    });
    audioContext = null;
  }
  hasUserInteraction = false;
  unlockAttempts = 0;
};
