// iOS audio handling utilities
let hasUserInteraction = false;

export const setUserInteraction = (value: boolean) => {
  hasUserInteraction = value;
};

export const getUserInteraction = () => hasUserInteraction;

// Initialize audio for iOS
export const initializeIOSAudio = async () => {
  try {
    // Create a temporary silent audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create and configure oscillator
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 0;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a short silent sound
    oscillator.start(0);
    oscillator.stop(0.001);
    
    // Create a silent audio element
    const audio = new Audio();
    audio.preload = 'none';
    audio.setAttribute('webkit-playsinline', 'true');
    audio.setAttribute('playsinline', 'true');
    
    // Try to play it (this will fail if no user interaction)
    try {
      await audio.play();
      audio.pause();
      setUserInteraction(true);
      return audioContext;
    } catch (e) {
      // Expected to fail without user interaction
      return null;
    }
  } catch (error) {
    console.error('iOS audio initialization failed:', error);
    return null;
  }
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
