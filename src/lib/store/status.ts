import { create } from 'zustand'

export interface StatusMessage {
  title: string
  description: string
  type: 'success' | 'error' | 'info' | 'warning'
  timestamp?: number
}

interface StatusStore {
  statusMessages: StatusMessage[]
  addStatusMessage: (message: StatusMessage) => void
  clearStatusMessages: () => void
}

export const useStatusMessages = create<StatusStore>((set) => ({
  statusMessages: [],
  addStatusMessage: (message: StatusMessage) =>
    set((state) => ({
      statusMessages: [
        ...state.statusMessages,
        {
          ...message,
          timestamp: Date.now()
        }
      ]
    })),
  clearStatusMessages: () => set({ statusMessages: [] })
}))
