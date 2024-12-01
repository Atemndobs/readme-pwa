'use client'

import * as React from 'react'
import { RefreshButton } from './refresh-button'
import { ThemeToggle } from './theme-toggle'
import { VoiceSelector } from './voice-selector'
import { VoiceInfo } from './voice-info'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAudioQueue } from '@/lib/store/audio-queue'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import { StorageSettings } from './storage-settings'
import { StorageIndicator } from './storage-indicator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getStorageStats } from '@/lib/utils/storage'

export function MobileNav() {
  const { queue } = useAudioQueue()

  const isProcessing = queue.some(item => 
    item.status === 'loading' || 
    item.status === 'playing' ||
    item.status === 'converting' ||
    item.status === 'partial'
  )

  const hasAudioContent = queue.some(item => 
    item.status === 'ready' || 
    item.status === 'playing' || 
    item.status === 'paused'
  )

  console.debug('MobileNav render:', {
    hasAudioContent,
    shouldHideVoiceInfo: hasAudioContent || isProcessing
  })

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="flex flex-1 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">ReadMe</h1>
              <div className="flex items-center">
                <RefreshButton />
                <ThemeToggle />
                <StorageIndicator />
              </div>
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Settings className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                  <SheetDescription>
                    Configure voice and storage preferences
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto py-6">
                  <Tabs defaultValue="voice" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="voice">Voice</TabsTrigger>
                      <TabsTrigger value="storage">Storage</TabsTrigger>
                    </TabsList>
                    <TabsContent value="voice" className="mt-4 space-y-4">
                      <VoiceSelector />
                    </TabsContent>
                    <TabsContent value="storage" className="mt-4">
                      <div className="h-[calc(100vh-12rem)] overflow-y-auto pb-8">
                        <StorageSettings />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
      {(!hasAudioContent && !isProcessing) && (
        <div className="border-b bg-muted/50">
          <div className="container flex h-10 items-center">
            <VoiceInfo />
          </div>
        </div>
      )}
    </>
  )
}
