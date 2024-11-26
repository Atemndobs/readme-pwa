'use client'

import { useSettings, voices, VoiceLanguage, countryFlags } from '@/lib/store/settings'
import { Button } from '@/components/ui/button'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const languageNames = {
  'voice-en-us': 'English',
  'voice-de': 'German',
  'voice-fr': 'French',
  'voice-es': 'Spanish',
  'voice-it': 'Italian',
} as const

export function VoiceInfo() {
  const { language, voice, setLanguage, setVoice } = useSettings()
  
  const currentVoice = voices[language].find(v => v.id === voice)
  const languageName = languageNames[language]

  const handleLanguageSelect = (newLanguage: VoiceLanguage) => {
    setLanguage(newLanguage)
    setVoice(voices[newLanguage][0].id)
  }

  const handleVoiceClick = () => {
    const currentVoiceList = voices[language]
    const currentIndex = currentVoiceList.findIndex((v) => v.id === voice)
    const nextIndex = (currentIndex + 1) % currentVoiceList.length
    setVoice(currentVoiceList[nextIndex].id)
  }

  const getAvatarUrl = (name: string, gender: string) => {
    // Using notionists style for consistent avatars
    if (name === 'Thorsten') {
      return `https://api.dicebear.com/7.x/notionists/svg?seed=christopher&radius=50&backgroundColor=b6e3f4`
    }
    
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${name}&radius=50&backgroundColor=b6e3f4`
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 text-muted-foreground hover:text-primary">
            <span className="flex items-center gap-1">
              <span>{countryFlags[language]}</span>
              <span>{languageName}</span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.entries(languageNames) as [VoiceLanguage, string][]).map(([key, name]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handleLanguageSelect(key)}
            >
              <span className="flex items-center gap-2">
                <span>{countryFlags[key]}</span>
                <span>{name}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="text-muted-foreground/60">{">>"}</span>
      <Button 
        variant="ghost" 
        className="h-auto p-0 text-muted-foreground hover:text-primary"
        onClick={handleVoiceClick}
      >
        <span className="flex items-center gap-1">
          {currentVoice && (
            <Avatar className="h-5 w-5">
              <AvatarImage 
                src={getAvatarUrl(currentVoice.name, currentVoice.gender)} 
                alt={currentVoice.name} 
              />
              <AvatarFallback>{currentVoice.name[0]}</AvatarFallback>
            </Avatar>
          )}
          <span>{currentVoice?.name}</span>
        </span>
      </Button>
    </div>
  )
}
