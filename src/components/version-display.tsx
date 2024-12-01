'use client'

import { useState } from 'react'
import { APP_VERSION } from '@/utils/version'
import { CHANGELOG, VersionInfo } from '@/utils/changelog'

export const VersionDisplay = () => {
  const [showChangelog, setShowChangelog] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string>(APP_VERSION)
  
  const versions = Object.values(CHANGELOG).sort((a, b) => 
    b.version.localeCompare(a.version)
  )

  const toggleVersion = () => {
    const prevVersion = versions[1]?.version
    setCurrentVersion(current => 
      current === APP_VERSION && prevVersion ? prevVersion : APP_VERSION
    )
  }

  return (
    <div className="fixed bottom-2 left-2 z-50">
      <button
        onClick={() => setShowChangelog(prev => !prev)}
        className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
      >
        <span>v{currentVersion}</span>
        {currentVersion !== APP_VERSION && (
          <span className="text-amber-500 dark:text-amber-400 text-[10px]">(previous)</span>
        )}
      </button>

      {showChangelog && (
        <div className="absolute bottom-full left-0 mb-2 bg-background rounded-lg shadow-lg dark:shadow-lg dark:shadow-black/30 p-4 min-w-[280px] border border-border">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-foreground">Version History</h3>
            <button 
              onClick={() => setShowChangelog(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-3">
            {versions.map((ver: VersionInfo) => (
              <div key={ver.version} className="text-sm">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentVersion(ver.version)
                      setShowChangelog(false)
                    }}
                    className={`font-medium ${
                      currentVersion === ver.version
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    } transition-colors`}
                  >
                    v{ver.version}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {ver.date}
                  </span>
                  {ver.version === APP_VERSION && (
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                      latest
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-1 list-disc list-inside text-muted-foreground">
                  {ver.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
