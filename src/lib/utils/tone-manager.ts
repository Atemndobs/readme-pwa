import * as Tone from 'tone';


class ToneAudioManager {
  private player: Tone.Player | null = null;
  private volume: Tone.Volume = new Tone.Volume(0).toDestination();
  private initialized = false;
  private onEndCallback: (() => void) | null = null;
  private static instance: ToneAudioManager;
  private lastPosition: number = 0; // Store the playback position

  
  constructor() {
    // Ensure singleton pattern
    if (ToneAudioManager.instance) {
      return ToneAudioManager.instance;
    }
    
    this.volume = new Tone.Volume(0).toDestination();
    Tone.context.lookAhead = 0.1; // Reduce latency
    ToneAudioManager.instance = this;
  }

  async initializeContext() {
    if (this.initialized) return;
    
    try {
      await Tone.start();
      if (Tone.context.state !== 'running') {
        await Tone.context.resume();
      }
      this.initialized = true;
      console.log('[ToneManager] Audio context initialized successfully');
    } catch (error) {
      console.error('[ToneManager] Failed to initialize audio context:', error);
      throw error;
    }
  }

  async loadAudio(url: string): Promise<Tone.Player> {
    try {
      await this.initializeContext();
      
      // Stop and cleanup any existing player
      this.stopAndCleanup();

      return new Promise((resolve, reject) => {
        this.player = new Tone.Player({
          url,
          autostart: false,
          onload: () => {
            console.log('[ToneManager] Audio loaded successfully');
            if (this.player) {
              this.player.connect(this.volume);
              
              // Set up the onEnd callback
              this.player.onstop = () => {
                console.log('[ToneManager] Audio playback ended');
                if (this.onEndCallback) {
                  this.onEndCallback();
                }
              };
              
              resolve(this.player);
            }
          },
          onerror: (error) => {
            console.error('[ToneManager] Error loading audio:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[ToneManager] Error in loadAudio:', error);
      throw error;
    }
  }
  
  async play() {
    if (!this.player) {
      throw new Error("No audio loaded");
    }
  
    const state = this.player.state as "started" | "stopped" | "paused";
  
    try {
      await this.initializeContext();
  
      if (state === "stopped") {
        // Start playback from the beginning
        this.lastPosition = 0;
        this.player.seek(0); // Ensure playback starts from the beginning
        this.player.start();
      } else if (state === "paused") {
        // Resume playback from the last position
        this.player.seek(this.lastPosition); // Set the playback position
        this.player.start();
      }else{
        this.pause()
      }
    } catch (error) {
      console.error("[ToneManager] Error playing audio:", error);
      throw error;
    }
  }
  
  pause() {
    console.log("[ToneManager] Attempting to pause. Current state:", this.player?.state);
    if (this.player && this.player.state === "started") {
        this.lastPosition = this.player.toSeconds(this.player.blockTime);
        this.player.stop(); // Stop the player (acts as "pause" here)
        console.log("Paused audio at position:", this.lastPosition);
    } else {
        console.log("Player is not in 'started' state, cannot pause.");
    }
}
  

  stopAndCleanup() {
    if (this.player) {
      if (this.player.state === 'started') {
        this.player.stop();
      }
      this.player.disconnect();
      this.player.dispose();
      this.player = null;
    }
  }

  setVolume(value: number) {
    // Convert 0-1 range to decibels (-Infinity to 0)
    this.volume.volume.value = value === 0 ? -Infinity : 20 * Math.log10(value);
  }

  setMute(muted: boolean) {
    this.volume.mute = muted;
  }
  getCurrentTime(): number {
    if (this.player && this.player.state === "started") {
      return this.player.toSeconds(this.player.blockTime);
    }
    return 0; // Return 0 if stopped or player is null
  }
  
  

  getDuration(): number {
    return this.player?.buffer?.duration ?? 0;
  }

  seek(time: number) {
    if (this.player) {
      this.player.seek(time);
    }
  }

  setOnEndCallback(callback: () => void) {
    this.onEndCallback = callback;
  }

  cleanup() {
    this.stopAndCleanup();
    this.initialized = false;
    this.onEndCallback = null;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Create a singleton instance
export const toneManager = new ToneAudioManager();
