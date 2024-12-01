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
      'Remove conditional rendering of VoiceSelector',
      'Update debug logging',
      'Remove unused text-input component'
    ]
  },
  '0.1.0': {
    version: '0.1.0',
    date: '2024-01-09',
    changes: [
      'Initial release',
      'Text-to-speech functionality',
      'Voice selection',
      'Audio queue management',
      'Storage management',
      'Mobile-friendly navigation'
    ]
  }
}

export const getVersionInfo = (version: string): VersionInfo | undefined => {
  return CHANGELOG[version]
}

export const getCurrentVersion = () => APP_VERSION
export const getPreviousVersionInfo = () => CHANGELOG[getPreviousVersion()]
