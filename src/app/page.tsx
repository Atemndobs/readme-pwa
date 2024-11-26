'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAudioQueue } from '@/lib/store/audio-queue'
import { useSettings } from '@/lib/store/settings'
import { MiniPlayer } from '@/components/audio-player/mini-player'
import { fetchUrlContent } from '@/lib/api/url-fetch'
import { toast } from 'sonner'
import { MobileNav } from '@/components/mobile-nav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function Home() {
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('url')
  const { voice } = useSettings()
  const { add, queue } = useAudioQueue()
  const tabsRef = useRef<HTMLDivElement>(null)
  const contentEditableRef = useRef<HTMLDivElement>(null)

  // Check if any item in the queue is currently loading or playing
  const isProcessing = queue.some(item => 
    item.status === 'loading' || 
    item.status === 'playing'
  )

  // Check if we have any ready or playing items
  const hasAudioContent = queue.some(item => 
    item.status === 'ready' || 
    item.status === 'playing' || 
    item.status === 'paused'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contentEditableRef.current) return
    
    const content = contentEditableRef.current.innerHTML
    if (!content.trim()) return

    try {
      await add(content, voice)
    } catch (error) {
      console.error('Failed to add text to queue:', error)
      toast.error('Failed to convert text to speech')
    }
  }

  const handleUrlFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    try {
      // Step 1: Fetch URL content
      console.log('1. Starting URL fetch...')
      const content = await fetchUrlContent(url)
      if (!content.text?.trim()) {
        throw new Error('No content found at the URL')
      }
      console.log('2. URL fetch completed, content received')
      
      // Step 2: Switch to text tab and update content
      console.log('3. Switching to text tab...')
      setActiveTab('text')
      setText(content.text)
      
      // Step 3: Update editor content after a short delay
      await new Promise(resolve => setTimeout(resolve, 100))
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = content.text
      }
      
      // Step 4: Start text-to-speech conversion
      console.log('4. Starting text-to-speech conversion...')
      await add(content.text, voice)
      console.log('5. Text-to-speech conversion completed')
      
      toast.success('Content fetched and conversion started')
    } catch (error) {
      console.error('Operation failed:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process URL content')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container mx-auto p-4 space-y-4 max-w-2xl pb-32">
      <MobileNav />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4">
          <form onSubmit={handleUrlFetch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">Enter URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading || isProcessing}
              />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || isProcessing || !url.trim()}
              className="w-full"
            >
              {isLoading ? 'Fetching...' : 'Fetch Content'}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="text">Enter Text</Label>
            <div
              ref={contentEditableRef}
              contentEditable
              className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-auto"
              onPaste={(e) => {
                e.preventDefault()
                const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text')
                document.execCommand('insertHTML', false, text)
              }}
            />
          </div>
          <Button 
            onClick={handleSubmit}
            disabled={isProcessing}
            className="w-full"
          >
            Convert to Speech
          </Button>
        </TabsContent>
      </Tabs>

      {hasAudioContent && <MiniPlayer />}
    </main>
  )
}
