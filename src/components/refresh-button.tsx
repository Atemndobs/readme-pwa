'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function RefreshButton() {
  const handleRefresh = () => {
    if ('serviceWorker' in navigator && window.workbox !== undefined) {
      // Skip waiting and reload all open tabs
      window.workbox.messageSkipWaiting()
      window.location.reload()
    } else {
      // Fallback for non-PWA or when workbox is not available
      window.location.reload()
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      title="Refresh app"
      className="h-9 w-9"
    >
      <RefreshCw className="h-5 w-5" />
    </Button>
  )
}
