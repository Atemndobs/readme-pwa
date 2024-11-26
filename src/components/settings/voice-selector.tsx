'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettings, voices, type VoiceLanguage } from '@/lib/store/settings';
import { Button } from '../ui/button';

export function VoiceSelector() {
  const { language, voice, setLanguage, setVoice } = useSettings();

  const handleLanguageChange = (newLanguage: VoiceLanguage) => {
    setLanguage(newLanguage);
    // Set the first voice of the new language as default
    setVoice(voices[newLanguage][0].id);
  };

  const handleVoiceClick = () => {
    const currentVoices = voices[language];
    const currentIndex = currentVoices.findIndex(v => v.id === voice);
    const nextIndex = (currentIndex + 1) % currentVoices.length;
    setVoice(currentVoices[nextIndex].id);
  };

  // Get current voice name
  const currentVoice = voices[language].find(v => v.id === voice)?.name || 'Select voice';

  return (
    <div className="flex gap-4">
      <Select value={language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="voice-en-us">English (US)</SelectItem>
          <SelectItem value="voice-de">German</SelectItem>
          <SelectItem value="voice-fr">French</SelectItem>
          <SelectItem value="voice-es">Spanish</SelectItem>
          <SelectItem value="voice-it">Italian</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        className="w-[180px] justify-start font-normal"
        onClick={handleVoiceClick}
      >
        {currentVoice}
      </Button>
    </div>
  );
}
