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
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
      >
        <span>v{currentVersion}</span>
        {currentVersion !== APP_VERSION && (
          <span className="text-amber-500 text-[10px]">(previous)</span>
        )}
      </button>

      {showChangelog && (
        <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg p-4 min-w-[280px] border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Version History</h3>
            <button 
              onClick={() => setShowChangelog(false)}
              className="text-gray-400 hover:text-gray-600"
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
                        ? 'text-blue-500' 
                        : 'text-gray-700 hover:text-blue-500'
                    }`}
                  >
                    v{ver.version}
                  </button>
                  {ver.version === APP_VERSION && (
                    <span className="text-xs text-green-500">(current)</span>
                  )}
                  <span className="text-xs text-gray-400">{ver.date}</span>
                </div>
                <ul className="mt-1 ml-4 text-xs text-gray-500 list-disc">
                  {ver.changes.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {currentVersion !== APP_VERSION && (
            <div className="mt-4 pt-2 border-t border-gray-100">
              <button
                onClick={toggleVersion}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                Switch to current version
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
