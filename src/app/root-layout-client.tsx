'use client'

import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import ClientInit from './client-init'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClientInit />
      {children}
      <Toaster position="top-center" />
    </ThemeProvider>
  )
}
