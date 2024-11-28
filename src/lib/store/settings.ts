import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const countryFlags = {
  'voice-en-us': '🇺🇸',
  'voice-de': '🇩🇪',
  'voice-fr': '🇫🇷',
  'voice-es': '🇪🇸',
  'voice-it': '🇮🇹',
} as const

export const voices = {
  "voice-en-us": [
    { id: "voice-en-us-amy-low", name: "Amy", gender: "female" },
    { id: "voice-en-us-danny-low", name: "Danny", gender: "male" },
    { id: "voice-en-us-ryan-low", name: "Ryan", gender: "male" },
    { id: "voice-en-us-kathleen-low", name: "Kathleen", gender: "female" },
  ],
  "voice-de": [
    { id: "voice-de-thorsten-low", name: "Thorsten", gender: "male" },
    { id: "voice-de-kerstin-low", name: "Kerstin", gender: "female" },
  ],
  "voice-fr": [
    { id: "voice-fr-jean-low", name: "Jean", gender: "male" },
    { id: "voice-fr-marie-low", name: "Marie", gender: "female" },
  ],
  "voice-es": [
    { id: "voice-es-pedro-low", name: "Pedro", gender: "male" },
    { id: "voice-es-lucia-low", name: "Lucia", gender: "female" },
  ],
  "voice-it": [
    { id: "voice-it-marco-low", name: "Marco", gender: "male" },
    { id: "voice-it-sofia-low", name: "Sofia", gender: "female" },
  ],
} as const;

export type VoiceLanguage = keyof typeof voices;
export type VoiceId = typeof voices[VoiceLanguage][number]['id'];

export interface StorageSettings {
  autoCleanup: boolean;
  cleanupThreshold: number;
  retentionDays: number;
}

export interface SettingsState {
  language: VoiceLanguage;
  voice: VoiceId;
  textInput: string;
  urlInput: string;
  activeTab: 'text' | 'url';
  storage: StorageSettings;
  setLanguage: (language: VoiceLanguage) => void;
  setVoice: (voice: VoiceId) => void;
  setTextInput: (text: string) => void;
  setUrlInput: (url: string) => void;
  setActiveTab: (tab: 'text' | 'url') => void;
  setStorage: (storage: StorageSettings) => void;
  clearTextInput: () => void;
  clearUrlInput: () => void;
}

export type Settings = SettingsState;

interface PersistedState {
  language: VoiceLanguage;
  voice: VoiceId;
  textInput: string;
  urlInput: string;
  activeTab: 'text' | 'url';
  storage: StorageSettings;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'voice-en-us',
      voice: 'voice-en-us-amy-low',
      textInput: '',
      urlInput: '',
      activeTab: 'text',
      storage: {
        autoCleanup: true,
        cleanupThreshold: 80,
        retentionDays: 7
      },
      setLanguage: (language) => set({ language }),
      setVoice: (voice) => set({ voice }),
      setTextInput: (text) => set({ textInput: text }),
      setUrlInput: (url) => set({ urlInput: url }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setStorage: (storage) => set({ storage }),
      clearTextInput: () => set({ textInput: '' }),
      clearUrlInput: () => set({ urlInput: '' }),
    }),
    {
      name: 'readme-settings',
      version: 1,
      migrate: (persistedState: any, version: number): PersistedState => {
        if (version === 0) {
          return {
            ...persistedState,
            storage: {
              autoCleanup: true,
              cleanupThreshold: 80,
              retentionDays: 7
            }
          }
        }
        return persistedState as PersistedState
      }
    }
  )
)
