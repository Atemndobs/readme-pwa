import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { useSettings } from '@/lib/store/settings'
import { clearStorage, getStorageStats, getStorageKeys, getStorageItemSize } from '@/lib/utils/storage'
import { ScrollArea } from '@/components/ui/scroll-area'

export function StorageSettings() {
  const { storage, setStorage } = useSettings()
  const stats = getStorageStats()
  const storageKeys = getStorageKeys()

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all storage? This action cannot be undone.')) {
      clearStorage()
    }
  }

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`
    }
    return `${(kb / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Storage Management</h3>
        <p className="text-sm text-muted-foreground">
          Configure how the app manages local storage
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-cleanup">Automatic Cleanup</Label>
          <Switch
            id="auto-cleanup"
            checked={storage.autoCleanup}
            onCheckedChange={(checked) =>
              setStorage({ ...storage, autoCleanup: checked })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Storage Threshold ({storage.cleanupThreshold}%)</Label>
          <Slider
            value={[storage.cleanupThreshold]}
            onValueChange={([value]) =>
              setStorage({ ...storage, cleanupThreshold: value })
            }
            min={50}
            max={95}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Automatic cleanup will trigger when storage usage exceeds this threshold
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Current Storage Usage</h4>
          <div className="rounded-md border p-4">
            <div className="text-sm">
              Used: {formatSize(stats.used)} of {formatSize(stats.total)} ({stats.percentage}%)
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Storage Items</h4>
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <div className="space-y-2">
              {storageKeys.map((key) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{key}</span>
                  <span className="ml-4 text-muted-foreground">
                    {formatSize(getStorageItemSize(key))}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => clearStorage(key)}
                    className="ml-2"
                  >
                    Clear
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Button
          variant="destructive"
          onClick={handleClearAll}
          className="w-full"
        >
          Clear All Storage
        </Button>
      </div>
    </div>
  )
}
