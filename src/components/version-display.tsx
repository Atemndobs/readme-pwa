import { APP_VERSION } from '@/utils/version'

export const VersionDisplay = () => {
  return (
    <div className="fixed bottom-2 right-2 text-xs text-gray-500">
      v{APP_VERSION}
    </div>
  )
}
