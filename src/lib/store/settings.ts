import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const voices = {
  "voice-en-us": [
    { id: "voice-en-us-amy-low", name: "Amy" },
    { id: "voice-en-us-danny-low", name: "Danny" },
    { id: "voice-en-us-ryan-low", name: "Ryan" },
    { id: "voice-en-us-kathleen-low", name: "Kathleen" },
  ],
  "voice-de": [
    { id: "voice-de-thorsten-low", name: "Thorsten" },
    { id: "voice-de-kerstin-low", name: "Kerstin" },
  ],
  "voice-fr": [
    { id: "voice-fr-jean-low", name: "Jean" },
    { id: "voice-fr-marie-low", name: "Marie" },
  ],
  "voice-es": [
    { id: "voice-es-pedro-low", name: "Pedro" },
    { id: "voice-es-lucia-low", name: "Lucia" },
  ],
  "voice-it": [
    { id: "voice-it-marco-low", name: "Marco" },
    { id: "voice-it-sofia-low", name: "Sofia" },
  ],
} as const;

export type VoiceLanguage = keyof typeof voices;
export type VoiceId = typeof voices[VoiceLanguage][number]['id'];

interface SettingsState {
  language: VoiceLanguage;
  voice: VoiceId;
  setLanguage: (language: VoiceLanguage) => void;
  setVoice: (voice: VoiceId) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'voice-en-us',
      voice: 'voice-en-us-amy-low',
      setLanguage: (language) => set({ language }),
      setVoice: (voice) => set({ voice }),
    }),
    {
      name: 'readme-settings',
    }
  )
)
