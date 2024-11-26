'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useSettings } from '@/lib/store/settings';
import { useAudioQueue } from '@/lib/store/audio-queue';
import { TTSError } from '@/lib/api/tts';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { VoiceSelector } from '../settings/voice-selector';
import { MiniPlayer } from '../audio-player/mini-player';

export function TextInput() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { voice } = useSettings();
  const { add } = useAudioQueue();

  const handleTextConvert = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      await add(text.trim(), voice);
      setText('');
      toast.success('Text converted to speech and added to queue');
    } catch (error) {
      console.error('Error converting text:', error);
      if (error instanceof TTSError) {
        toast.error(error.message);
      } else {
        toast.error('An unexpected error occurred while converting text to speech');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUrlFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      // TODO: Implement URL content fetching with Readability
      console.log('Fetching URL:', url);
      setUrl('');
      toast.error('URL fetching is not implemented yet');
    } catch (error) {
      console.error('Error fetching URL:', error);
      toast.error('Failed to fetch content from URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Convert Text to Speech</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <VoiceSelector />
          </div>
          <MiniPlayer />
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text Input</TabsTrigger>
              <TabsTrigger value="url">URL Input</TabsTrigger>
            </TabsList>
            <TabsContent value="text">
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter text to convert..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[200px]"
                  disabled={loading}
                />
                <Button 
                  onClick={handleTextConvert} 
                  disabled={loading || !text.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    'Convert to Speech'
                  )}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="url">
              <div className="space-y-4">
                <Input
                  type="url"
                  placeholder="Enter URL to fetch content..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                />
                <Button 
                  onClick={handleUrlFetch}
                  disabled={loading || !url.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    'Fetch and Convert'
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
