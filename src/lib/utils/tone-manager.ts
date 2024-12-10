import * as Tone from 'tone';

/**
 * ToneAudioManager is a singleton class responsible for managing audio playback using the Tone.js library.
 * It provides methods for loading audio, playing, pausing, stopping, and seeking audio, as well as setting volume and mute.
 * It also handles audio context initialization and cleanup.
 */
class ToneAudioManager {
  private player: any = null;
  private volume: any = null;
  private initialized = false;
  private onEndCallback: (() => void) | null = null;
  private static instance: ToneAudioManager;
  private lastPosition: number = 0; // Store the playback position

  /**
   * Constructor for ToneAudioManager.
   * Ensures singleton pattern and initializes Tone.js if in the browser environment.
   */
  constructor() {
    // Ensure singleton pattern
    if (ToneAudioManager.instance) {
      return ToneAudioManager.instance;
    }

    // Only initialize if we're in the browser
    if (typeof window !== 'undefined') {
      this.initializeTone();
    }
    
    ToneAudioManager.instance = this;
  }

  /**
   * Initializes Tone.js and sets up the audio context.
   * This method is only called if we're in the browser environment.
   */
  private async initializeTone() {
    if (this.initialized) return;
    
    const Tone = await import('tone');
    this.volume = new Tone.Volume(0).toDestination();
    Tone.context.lookAhead = 0.1; // Reduce latency
    this.initialized = true;
  }

  /**
   * Initializes the audio context.
   * This method is only called if we're in the browser environment.
   */
  async initializeContext() {
    if (this.initialized) return;
    
    try {
      const Tone = await import('tone');
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

  /**
   * Loads audio from the specified URL.
   * @param url The URL of the audio file to load.
   * @returns A promise that resolves with the loaded Tone.Player instance.
   */
  async loadAudio(url: string): Promise<any> {
    try {
      await this.initializeContext();
      
      // Clean up any existing player
      this.stopAndCleanup();

      const Tone = await import('tone');
      
      return new Promise((resolve, reject) => {
        this.player = new Tone.Player({
          url,
          autostart: false,
          onload: () => {
            console.log("[ToneManager] Audio loaded successfully");
            if (this.player) {
              this.player.connect(this.volume);
              resolve(this.player);
            } else {
              reject(new Error("Player is null after loading"));
            }
          },
          onerror: (error: Error) => {
            console.error("[ToneManager] Error loading audio:", error);
            reject(error);
          }
        }).toDestination();
      });
    } catch (error) {
      console.error('[ToneManager] Error in loadAudio:', error);
      throw error;
    }
  }
  
  /**
   * Plays the loaded audio.
   * If the audio is already playing, it will be paused instead.
   */
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
  
  /**
   * Pauses the playing audio.
   */
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

  /**
   * Stops and cleans up the current player.
   */
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

  /**
   * Sets the volume of the audio.
   * @param value The volume value, ranging from 0 to 1.
   */
  setVolume(value: number) {
    // Convert 0-1 range to decibels (-Infinity to 0)
    this.volume.volume.value = value === 0 ? -Infinity : 20 * Math.log10(value);
  }

  /**
   * Sets the mute state of the audio.
   * @param muted Whether the audio should be muted or not.
   */
  setMute(muted: boolean) {
    this.volume.mute = muted;
  }

  /**
   * Gets the current playback time of the audio.
   * @returns The current playback time in seconds.
   */
  getCurrentTime(): number {
    if (this.player && this.player.state === "started") {
      return this.player.toSeconds(this.player.blockTime);
    }
    return 0; // Return 0 if stopped or player is null
  }

  /**
   * Gets the duration of the loaded audio.
   * @returns The duration of the audio in seconds.
   */
  getDuration(): number {
    return this.player?.buffer?.duration ?? 0;
  }

  /**
   * Seeks to the specified time in the audio.
   * @param time The time to seek to, in seconds.
   */
  seek(time: number) {
    if (this.player) {
      this.player.seek(time);
    }
  }

  /**
   * Sets the callback function to be called when the audio playback ends.
   * @param callback The callback function to be called.
   */
  setOnEndCallback(callback: () => void) {
    this.onEndCallback = callback;
  }

  /**
   * Cleans up the audio manager, stopping any playing audio and disposing of the player.
   */
  cleanup() {
    this.stopAndCleanup();
    this.initialized = false;
    this.onEndCallback = null;
  }

  /**
   * Checks if the audio manager has been initialized.
   * @returns Whether the audio manager has been initialized or not.
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Create a singleton instance
export const toneManager = new ToneAudioManager();
