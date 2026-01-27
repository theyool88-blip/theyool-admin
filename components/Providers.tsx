'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/hooks/useTheme'

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="light">
      {children}
    </ThemeProvider>
  )
}
