'use client'

import { useSettings, voices } from '@/lib/store/settings'

const languageNames = {
  'voice-en-us': 'English',
  'voice-de': 'German',
  'voice-fr': 'French',
  'voice-es': 'Spanish',
  'voice-it': 'Italian',
} as const

export function VoiceInfo() {
  const { language, voice } = useSettings()
  
  // Find the current voice name
  const currentVoice = voices[language].find(v => v.id === voice)
  const languageName = languageNames[language]

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>{languageName}</span>
      <span className="text-muted-foreground/60">{">>"}</span>
      <span>{currentVoice?.name}</span>
    </div>
  )
}
