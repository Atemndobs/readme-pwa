'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettings, voices, type VoiceLanguage } from '@/lib/store/settings';

export function VoiceSelector() {
  const { language, voice, setLanguage, setVoice } = useSettings();

  const handleLanguageChange = (newLanguage: VoiceLanguage) => {
    setLanguage(newLanguage);
    // Set the first voice of the new language as default
    setVoice(voices[newLanguage][0].id);
  };

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

      <Select value={voice} onValueChange={setVoice}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select voice" />
        </SelectTrigger>
        <SelectContent>
          {voices[language].map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
