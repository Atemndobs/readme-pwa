'use client'

import * as React from 'react'
import { RefreshButton } from './refresh-button'
import { ThemeToggle } from './theme-toggle'
import { VoiceSelector } from './voice-selector'
import { VoiceInfo } from './voice-info'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                  <SheetDescription>
                    Configure voice and storage preferences
                  </SheetDescription>
                </SheetHeader>
                <div className="py-6">
                  <Tabs defaultValue="voice" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="voice">Voice</TabsTrigger>
                      <TabsTrigger value="storage">Storage</TabsTrigger>
                    </TabsList>
                    <TabsContent value="voice" className="mt-4 space-y-4">
                      <VoiceSelector />
                    </TabsContent>
                    <TabsContent value="storage" className="mt-4">
                      <StorageSettings />
                    </TabsContent>
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
      <div className="border-b bg-muted/50">
        <div className="container flex h-10 items-center">
          <VoiceInfo />
        </div>
      </div>
    </>
  )
}
