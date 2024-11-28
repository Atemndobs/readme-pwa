import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useSettings } from '@/lib/store/settings'
import { 
  clearStorage, 
  getStorageStats, 
  getStorageKeys, 
  STORAGE_QUOTA,
  type StorageStats 
} from '@/lib/utils/storage'
import { ScrollArea } from '@/components/ui/scroll-area'
import { performCleanup, setupAutoCleanup, needsCleanup } from '@/lib/utils/storage-cleanup'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function StorageSettings() {
  const { storage, setStorage } = useSettings()
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [storageStats, setStorageStats] = useState<StorageStats>({
    used: 0,
    total: STORAGE_QUOTA,
    percentage: 0,
    items: {}
  })
  const [cleanupNeeded, setCleanupNeeded] = useState(false)

  // Setup auto cleanup
  useEffect(() => {
    if (storage.autoCleanup) {
      const cleanup = setupAutoCleanup()
      return cleanup
    }
  }, [storage.autoCleanup])

  useEffect(() => {
    const updateStats = async () => {
      const stats = await getStorageStats()
      setStorageStats(stats)
    }
    updateStats()

    // Update stats when storage changes
    const handleStorageChange = () => {
      updateStats()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Check if cleanup is needed
  useEffect(() => {
    const checkCleanup = async () => {
      const needs = await needsCleanup()
      setCleanupNeeded(needs)
    }
    checkCleanup()
  }, [storageStats])

  const handleClearAll = () => {
    setShowClearConfirm(true)
  }

  const confirmClearAll = () => {
    clearStorage()
    setShowClearConfirm(false)
    toast.success('Storage cleared successfully')
  }

  const handleManualCleanup = async () => {
    await performCleanup(true)
    toast.success('Storage cleanup completed')
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(1)} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Storage Management</h3>
          <p className="text-sm text-muted-foreground">
            Configure how the app manages local storage
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-cleanup">Automatic Cleanup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically clean up old data when storage is full
              </p>
            </div>
            <Switch
              id="auto-cleanup"
              checked={storage.autoCleanup}
              onCheckedChange={(checked) =>
                setStorage({ ...storage, autoCleanup: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Cleanup Threshold ({storage.cleanupThreshold}%)</Label>
            <Slider
              value={[storage.cleanupThreshold]}
              onValueChange={([value]) =>
                setStorage({ ...storage, cleanupThreshold: value })
              }
              min={50}
              max={90}
              step={5}
            />
            <p className="text-sm text-muted-foreground">
              Start cleanup when storage usage exceeds this threshold
            </p>
          </div>

          <div className="space-y-2">
            <Label>Data Retention ({storage.retentionDays} days)</Label>
            <Slider
              value={[storage.retentionDays]}
              onValueChange={([value]) =>
                setStorage({ ...storage, retentionDays: value })
              }
              min={1}
              max={30}
              step={1}
            />
            <p className="text-sm text-muted-foreground">
              Automatically remove data older than this
            </p>
          </div>

          <div className="space-y-2">
            <Label>Storage Used</Label>
            <div className="text-sm text-muted-foreground">
              {formatSize(storageStats.used)} / {formatSize(storageStats.total)}
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${storageStats.percentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Storage Items</Label>
            <ScrollArea className="h-[120px] rounded-md border p-2">
              {Object.entries(storageStats.items).map(([key, size]) => (
                <div key={key} className="flex justify-between py-1">
                  <span className="text-sm">{key}</span>
                  <span className="text-sm text-muted-foreground">{formatSize(size)}</span>
                </div>
              ))}
            </ScrollArea>
          </div>

          <div className="flex justify-between">
            <Button
              variant="destructive"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
            <Button
              variant={cleanupNeeded ? "default" : "secondary"}
              onClick={handleManualCleanup}
              disabled={!cleanupNeeded}
            >
              {cleanupNeeded && <AlertTriangle className="w-4 h-4 mr-2" />}
              Run Cleanup
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Storage</DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all storage? This action cannot be undone and will remove all saved audio data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClearAll}>
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
