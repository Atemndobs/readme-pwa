'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useSettings, voices, countryFlags } from '@/lib/store/settings'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { XIcon } from 'lucide-react'

export function VoiceSelector() {
  const { 
    language, 
    voice, 
    textInput,
    urlInput,
    activeTab,
    setLanguage, 
    setVoice,
    setTextInput,
    setUrlInput,
    setActiveTab,
    clearTextInput,
    clearUrlInput,
  } = useSettings()

  const handleLanguageChange = (value: string) => {
    const newLanguage = value as VoiceLanguage
    setLanguage(newLanguage)
    // Set first voice of the new language as default
    setVoice(voices[newLanguage][0].id)
  }

  const handleVoiceClick = () => {
    const currentVoiceList = voices[language]
    const currentIndex = currentVoiceList.findIndex((v) => v.id === voice)
    const nextIndex = (currentIndex + 1) % currentVoiceList.length
    setVoice(currentVoiceList[nextIndex].id)
  }

  const currentVoice = voices[language].find((v) => v.id === voice)
  const getAvatarUrl = (name: string, gender: string) => {
    // Using notionists style for consistent avatars
    if (name === 'Thorsten') {
      return `https://api.dicebear.com/7.x/notionists/svg?seed=christopher&radius=50&backgroundColor=b6e3f4`
    }
    
    return `https://api.dicebear.com/7.x/notionists/svg?seed=${name}&radius=50&backgroundColor=b6e3f4`
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voice-en-us">
              <span className="flex items-center gap-2">
                <span>{countryFlags['voice-en-us']}</span>
                <span>English (US)</span>
              </span>
            </SelectItem>
            <SelectItem value="voice-de">
              <span className="flex items-center gap-2">
                <span>{countryFlags['voice-de']}</span>
                <span>German</span>
              </span>
            </SelectItem>
            <SelectItem value="voice-fr">
              <span className="flex items-center gap-2">
                <span>{countryFlags['voice-fr']}</span>
                <span>French</span>
              </span>
            </SelectItem>
            <SelectItem value="voice-es">
              <span className="flex items-center gap-2">
                <span>{countryFlags['voice-es']}</span>
                <span>Spanish</span>
              </span>
            </SelectItem>
            <SelectItem value="voice-it">
              <span className="flex items-center gap-2">
                <span>{countryFlags['voice-it']}</span>
                <span>Italian</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="outline" 
          className="w-[180px] justify-between"
          onClick={handleVoiceClick}
        >
          <span className="flex items-center gap-2">
            {currentVoice && (
              <Avatar className="h-6 w-6">
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

      <div className="w-full">
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="url">URL</TabsTrigger>
          </TabsList>
          <TabsContent value="text" className="mt-2">
            <div className="relative">
              <Textarea
                placeholder="Enter text to convert to speech..."
                className="min-h-[100px] resize-none"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              {textInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 hover:bg-transparent"
                  onClick={clearTextInput}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>
          <TabsContent value="url" className="mt-2">
            <div className="relative">
              <Input
                type="url"
                placeholder="Enter URL to extract text from..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              {urlInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 hover:bg-transparent"
                  onClick={clearUrlInput}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
