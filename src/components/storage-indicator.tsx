import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DatabaseIcon } from 'lucide-react';
import { getStorageStats, StorageStats } from '@/lib/utils/storage';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function StorageIndicator() {
  const [stats, setStats] = useState<StorageStats>({ used: 0, total: 0, percentage: 0 });

  useEffect(() => {
    const updateStats = () => {
      setStats(getStorageStats());
    };

    updateStats();
    window.addEventListener('storage', updateStats);
    return () => window.removeEventListener('storage', updateStats);
  }, []);

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

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
