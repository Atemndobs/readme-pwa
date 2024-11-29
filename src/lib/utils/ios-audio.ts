// iOS audio handling utilities
let hasUserInteraction = false;

export const setUserInteraction = (value: boolean) => {
  hasUserInteraction = value;
};

export const getUserInteraction = () => hasUserInteraction;

// Initialize audio for iOS
export const initializeIOSAudio = async () => {
  // Create a temporary silent audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  // Set volume to 0
  gainNode.gain.value = 0;
  
  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // Start and stop quickly
  oscillator.start(0);
  oscillator.stop(0.001);
  
  return audioContext;
};

// Handle iOS audio initialization
export const handleIOSAudioInit = async () => {
  try {
    if (!hasUserInteraction) {
      await initializeIOSAudio();
      setUserInteraction(true);
      return true;
    }
    return true;
  } catch (error) {
    console.error('iOS audio initialization failed:', error);
    return false;
  }
};
