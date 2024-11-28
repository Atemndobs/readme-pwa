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

interface SettingsState {
  language: VoiceLanguage;
  voice: VoiceId;
  textInput: string;
  urlInput: string;
  activeTab: 'text' | 'url';
  storage: {
    autoCleanup: boolean;
    maxStoragePercentage: number;
    cleanupThreshold: number;
  };
  setLanguage: (language: VoiceLanguage) => void;
  setVoice: (voice: VoiceId) => void;
  setTextInput: (text: string) => void;
  setUrlInput: (url: string) => void;
  setActiveTab: (tab: 'text' | 'url') => void;
  clearTextInput: () => void;
  clearUrlInput: () => void;
  setStorage: (storage: SettingsState['storage']) => void;
}

type PersistedState = Omit<SettingsState, 
  'setLanguage' | 'setVoice' | 'setTextInput' | 'setUrlInput' | 'setActiveTab' | 'clearTextInput' | 'clearUrlInput' | 'setStorage'
>

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
        maxStoragePercentage: 90,
        cleanupThreshold: 80,
      },
      setLanguage: (language) => set({ language }),
      setVoice: (voice) => set({ voice }),
      setTextInput: (text) => set({ textInput: text }),
      setUrlInput: (url) => set({ urlInput: url }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      clearTextInput: () => set({ textInput: '' }),
      clearUrlInput: () => set({ urlInput: '' }),
      setStorage: (storage) => set({ storage }),
    }),
    {
      name: 'readme-settings',
      version: 1,
      migrate: (persistedState: any, version: number): PersistedState => {
        if (version === 0) {
          return {
            ...persistedState,
            textInput: persistedState.textInput || '',
            urlInput: persistedState.urlInput || '',
            activeTab: persistedState.activeTab || 'text',
            storage: {
              autoCleanup: true,
              maxStoragePercentage: 90,
              cleanupThreshold: 80,
            },
          }
        }
        return persistedState as PersistedState
      },
    }
  )
)
