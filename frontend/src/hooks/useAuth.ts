import { useContext } from 'react'
import type { AuthContextValue } from '../auth/AuthContext'
import { AuthContext } from '../auth/AuthContext'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}