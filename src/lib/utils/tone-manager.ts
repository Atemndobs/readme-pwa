import * as Tone from 'tone';

class ToneAudioManager {
  private player: Tone.Player | null = null;
  private volume: Tone.Volume;
  private initialized = false;
  private onEndCallback: (() => void) | null = null;
  private static instance: ToneAudioManager;
  
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
      throw new Error('No audio loaded');
    }
    
    try {
      await this.initializeContext();
      if (this.player.state !== 'started') {
        await this.player.start();
      }
    } catch (error) {
      console.error('[ToneManager] Error playing audio:', error);
      throw error;
    }
  }

  pause() {
    if (this.player && this.player.state === 'started') {
      this.player.stop();
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
    return this.player ? this.player.currentTime : 0;
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
