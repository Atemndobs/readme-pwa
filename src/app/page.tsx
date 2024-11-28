'use client'

import { useState, useRef, useEffect } from 'react'
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
import { XIcon, CopyIcon, CheckIcon, Loader2, Minimize2, Maximize2, ChevronDown, ClipboardIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [conversionStatus, setConversionStatus] = useState(0)
  const [urlInput, setUrlInput] = useState('')
  const [activeTab, setActiveTab] = useState<'url' | 'text'>('text')
  const [inputSize, setInputSize] = useState<'compact' | 'full' | 'folded'>('compact')
  const statusMessages = [
    "Analyzing your text...",
    "Warming up the voice box...",
    "Teaching the AI to speak...",
    "Adding human-like expressions...",
    "Fine-tuning the pronunciation...",
    "Almost there, final touches...",
    "Adjusting vocal resonance...",
    "Polishing speech patterns...",
    "Synchronizing pitch and tone...",
    "Adding natural pauses...",
    "Making it sound just right..."
  ]

  const { 
    voice,
    textInput,
    setTextInput,
  } = useSettings()
  const { 
    add, 
    queue 
  } = useAudioQueue()
  const tabsRef = useRef<HTMLDivElement>(null)
  const contentEditableRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only set innerHTML on the client side
    if (contentEditableRef.current && textInput) {
      contentEditableRef.current.innerHTML = textInput
    }
  }, [textInput])

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isConverting) {
      interval = setInterval(() => {
        setConversionStatus((prev) => (prev + 1) % statusMessages.length)
      }, 2000)
    } else {
      setConversionStatus(0)
    }
    return () => clearInterval(interval)
  }, [isConverting])

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
      setIsConverting(true)
      setTextInput(content)
      await add(content, voice)
    } catch (error) {
      console.error('Failed to add text to queue:', error)
      toast.error('Failed to convert text to speech')
    } finally {
      setIsConverting(false)
    }
  }

  const handleUrlFetch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setIsLoading(true)
    try {
      console.log('1. Starting URL fetch...')
      const content = await fetchUrlContent(urlInput)
      if (!content.text?.trim()) {
        throw new Error('No content found at the URL')
      }
      console.log('2. URL fetch completed, content received')
      
      console.log('3. Switching to text tab...')
      setActiveTab('text')
      setTextInput(content.text)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      if (contentEditableRef.current) {
        contentEditableRef.current.innerHTML = content.text
      }
      
      console.log('4. Starting text-to-speech conversion...')
      await add(content.text, voice, urlInput)
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
      <MiniPlayer />
      
      <Tabs 
        value={activeTab as string} 
        onValueChange={(value) => setActiveTab(value as "url" | "text")} 
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-4">
          <form onSubmit={handleUrlFetch} className="space-y-4">
            <div className="space-y-2">
              <div className="relative">
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isLoading || isProcessing}
                />
                {urlInput && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 hover:bg-transparent"
                    onClick={() => setUrlInput('')}
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {urlInput.trim() && (
              <Button 
                type="submit" 
                disabled={isLoading || isProcessing}
                className="w-full"
              >
                {isLoading ? 'Fetching...' : 'Fetch Content'}
              </Button>
            )}
          </form>
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          {textInput.trim() && (
            <Button 
              onClick={handleSubmit}
              disabled={isProcessing || isConverting}
              className="w-full relative h-10 overflow-hidden"
            >
              {isConverting ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="speaker-container flex items-center gap-1 w-24">
                    <div className="speaker">
                      <style jsx>{`
                        .speaker {
                          font-size: 1.5rem;
                          transform: scaleX(1);
                        }
                        @keyframes soundWave {
                          0% {
                            opacity: 0;
                            transform: translateX(-10px);
                          }
                          20% {
                            opacity: 1;
                          }
                          100% {
                            opacity: 0;
                            transform: translateX(15px);
                          }
                        }
                        .sound-wave {
                          display: inline-flex;
                          gap: 2px;
                          margin-left: 4px;
                        }
                        .wave {
                          width: 3px;
                          height: 3px;
                          background-color: currentColor;
                          border-radius: 50%;
                          animation: soundWave 1.5s infinite;
                          opacity: 0;
                        }
                        .wave:nth-child(2) {
                          animation-delay: 0.2s;
                        }
                        .wave:nth-child(3) {
                          animation-delay: 0.4s;
                        }
                      `}</style>
                      🔊
                      <div className="sound-wave inline-flex">
                        <div className="wave" />
                        <div className="wave" />
                        <div className="wave" />
                      </div>
                    </div>
                  </div>
                  <span className="inline-block min-w-[200px] text-center transition-opacity duration-200">
                    {statusMessages[conversionStatus]}
                  </span>
                </div>
              ) : (
                'Convert to Speech'
              )}
            </Button>
          )}
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute left-2 top-2 flex gap-1.5 z-50 p-1 rounded-md">
                {/* Fold Button (like close) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-5 w-5 rounded-full p-0 hover:bg-red-500/20",
                    inputSize === 'folded' ? "bg-red-500" : "bg-red-500/80",
                    "transition-colors duration-200"
                  )}
                  onClick={() => setInputSize('folded')}
                  title="Fold view"
                >
                  <ChevronDown className="h-3 w-3 text-red-800/80" />
                </Button>

                {/* Compact Button (like minimize) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-5 w-5 rounded-full p-0 hover:bg-yellow-500/20",
                    inputSize === 'compact' ? "bg-yellow-500" : "bg-yellow-500/80",
                    "transition-colors duration-200"
                  )}
                  onClick={() => setInputSize('compact')}
                  title="Compact view"
                >
                  <Minimize2 className="h-3 w-3 text-yellow-800/80" />
                </Button>

                {/* Full Button (like maximize) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-5 w-5 rounded-full p-0 hover:bg-green-500/20",
                    inputSize === 'full' ? "bg-green-500" : "bg-green-500/80",
                    "transition-colors duration-200"
                  )}
                  onClick={() => setInputSize('full')}
                  title="Full view"
                >
                  <Maximize2 className="h-3 w-3 text-green-800/80" />
                </Button>
              </div>
              <div
                ref={contentEditableRef}
                contentEditable
                style={{
                  minHeight: inputSize === 'compact' ? '480px' : 
                           inputSize === 'full' ? 'calc(100vh - 16rem)' : 
                           '0px',
                  transition: 'min-height 0.3s ease-in-out',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word'
                }}
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 pt-14 pb-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto relative",
                  inputSize === 'folded' && "max-h-[0px] overflow-hidden opacity-50 border-0 m-0 p-0"
                )}
                onPaste={(e) => {
                  e.preventDefault()
                  const text = e.clipboardData.getData('text/html') || e.clipboardData.getData('text')
                  document.execCommand('insertHTML', false, text)
                  setTextInput(contentEditableRef.current?.innerHTML || '')
                }}
                onInput={() => {
                  setTextInput(contentEditableRef.current?.innerHTML || '')
                }}
              />
              <div className="absolute right-2 top-2 flex gap-2 bg-background/80 backdrop-blur-sm p-1 rounded-md z-10">
                {textInput && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      onClick={async () => {
                        const selectedText = window.getSelection()?.toString()
                        const textToCopy = selectedText || textInput
                        
                        if (textToCopy) {
                          await navigator.clipboard.writeText(textToCopy)
                          setIsCopied(true)
                          toast.success(selectedText ? 'Selected text copied!' : 'All text copied!')
                          setTimeout(() => setIsCopied(false), 2000)
                        }
                      }}
                    >
                      {isCopied ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <CopyIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText()
                          if (contentEditableRef.current) {
                            document.execCommand('insertText', false, text)
                            setTextInput(contentEditableRef.current.innerHTML)
                          }
                        } catch (error) {
                          console.error('Failed to paste text:', error)
                          toast.error('Failed to paste text')
                        }
                      }}
                      title="Paste"
                    >
                      <ClipboardIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-transparent"
                      onClick={() => {
                        setTextInput('')
                        if (contentEditableRef.current) {
                          contentEditableRef.current.innerHTML = ''
                        }
                      }}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}
