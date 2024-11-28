import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DatabaseIcon } from 'lucide-react';
import { getStorageStats, StorageStats, STORAGE_QUOTA } from '@/lib/utils/storage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function StorageIndicator() {
  const [stats, setStats] = useState<StorageStats>({ 
    used: 0, 
    total: STORAGE_QUOTA, 
    percentage: 0,
    items: {} 
  });

  useEffect(() => {
    let mounted = true;
    console.log('StorageIndicator mounted');

    const updateStats = async () => {
      try {
        console.log('Updating storage stats...');
        const newStats = await getStorageStats();
        if (mounted) {
          console.log('Setting new storage stats:', newStats);
          setStats(newStats);
        } else {
          console.log('Component unmounted, skipping stats update');
        }
      } catch (error) {
        console.error('Error updating storage stats:', error);
      }
    };

    // Initial update
    updateStats();
    
    // Update periodically
    const intervalId = setInterval(() => {
      console.log('Running periodic storage stats update');
      updateStats();
    }, 5000);

    // Listen for storage changes
    const handleStorageChange = () => {
      console.log('Storage change event detected');
      updateStats();
    };

    // Listen for both localStorage and custom storage events
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('indexeddb-storage-change', handleStorageChange);

    return () => {
      console.log('StorageIndicator unmounting');
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('indexeddb-storage-change', handleStorageChange);
    };
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes.toFixed(1)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  console.log('StorageIndicator rendering with stats:', stats);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-12 px-0 flex items-center justify-center"
          >
            <DatabaseIcon className="h-4 w-4 mr-1" />
            <span className="text-xs">{stats.percentage}%</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="w-64">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Storage Used</span>
              <span>{stats.percentage}%</span>
            </div>
            <Progress value={stats.percentage} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {formatSize(stats.used)} of {formatSize(stats.total)}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
