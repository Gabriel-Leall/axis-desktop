import { createContext } from 'react'
import type { ResolvedTheme } from '@/lib/theme'

export type Theme = 'dark' | 'light' | 'system'

export interface ThemeProviderState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
}

export const ThemeProviderContext =
  createContext<ThemeProviderState>(initialState)
