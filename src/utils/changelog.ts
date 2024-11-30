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
      'Current production version',
      'Added version switching capability',
      'Improved deployment process'
    ]
  },
  [getPreviousVersion()]: {
    version: getPreviousVersion(),
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday
    changes: [
      'Previous stable version',
      'Base functionality'
    ]
  }
}

export const getVersionInfo = (version: string): VersionInfo | undefined => {
  return CHANGELOG[version]
}

export const getCurrentVersion = () => APP_VERSION
export const getPreviousVersionInfo = () => CHANGELOG[getPreviousVersion()]
