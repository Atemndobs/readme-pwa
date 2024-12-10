'use client'

import { useState } from 'react'
import { APP_VERSION } from '@/utils/version'
import { CHANGELOG, VersionInfo, getCurrentVersion } from '@/utils/changelog'

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

  const getChangeType = (change: string): string => {
    if (change.startsWith('Add:')) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
    if (change.startsWith('Fix:')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    if (change.startsWith('Update:')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
    if (change.startsWith('Improve:')) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
    return 'bg-gray-100 dark:bg-gray-800/30 text-gray-800 dark:text-gray-300'
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
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-background border rounded-lg shadow-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Changelog</h3>
            <button
              onClick={() => setShowChangelog(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {versions.map((version) => (
              <div key={version.version} className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">
                    v{version.version}
                    {version.version === APP_VERSION && (
                      <span className="ml-2 text-xs text-green-500">(current)</span>
                    )}
                  </h4>
                  <span className="text-xs text-muted-foreground">{version.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {version.changes.map((change, i) => (
                    <li
                      key={i}
                      className={`text-xs px-2 py-1 rounded ${getChangeType(change)}`}
                    >
                      {change}
                    </li>
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
