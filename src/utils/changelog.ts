import { APP_VERSION } from './version'

export type VersionInfo = {
  version: string
  date: string
  changes: string[]
}

// Get previous version number
const getPreviousVersion = () => {
  const [major, minor, patch] = APP_VERSION.split('.').map(Number)
  return patch > 0 ? `${major}.${minor}.${patch - 1}` : APP_VERSION
}

export const CHANGELOG: Record<string, VersionInfo> = {
  [APP_VERSION]: {
    version: APP_VERSION,
    date: new Date().toISOString().split('T')[0],
    changes: [
      'Add: Enhanced audio playback controls with toggle play/pause',
      'Add: Segment-based seeking in audio progress bar',
      'Update: Improved audio state management and error handling',
      'Add: Comprehensive audio system architecture documentation',
      'Fix: Audio player state synchronization issues',
      'Improve: Audio segment transition handling'
    ]
  },
  '0.1.2': {
    version: '0.1.2',
    date: '2024-12-10',
    changes: [
      'Add: Fixed audio player at bottom of screen',
      'Update: Move notifications to top of screen',
      'Fix: Prevent notification overlap with audio player',
      'Improve: Audio player visibility and accessibility'
    ]
  },
  '0.1.1': {
    version: '0.1.1',
    date: '2024-01-10',
    changes: [
      'Fix: TypeScript error in MobileNav component',
      'Remove conditional rendering of VoiceSelector'
    ]
  }
}

export function getVersionInfo(version: string): VersionInfo | undefined {
  return CHANGELOG[version]
}

export function getCurrentVersion(): VersionInfo {
  return CHANGELOG[APP_VERSION]
}

export function getPreviousVersionInfo(): VersionInfo | undefined {
  return CHANGELOG[getPreviousVersion()]
}
