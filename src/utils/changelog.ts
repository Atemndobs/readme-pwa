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
      'Feature: Add version tracking and changelog',
      'Improve deployment automation',
      'Add version display component'
    ]
  },
  '0.9.0': {
    version: '1.0.0',
    date: '2024-11-30',
    changes: [
      'Initial release',
      'Base functionality implemented'
    ]
  }
}

export const getVersionInfo = (version: string): VersionInfo | undefined => {
  return CHANGELOG[version]
}

export const getCurrentVersion = () => APP_VERSION
export const getPreviousVersionInfo = () => CHANGELOG[getPreviousVersion()]
