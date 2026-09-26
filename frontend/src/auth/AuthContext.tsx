import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth'
import { tokenStore } from '../api/client'
import type { LoginResponse, UserMe } from '../types'

export interface AuthContextValue {
  user: UserMe | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiLogin({ email, password })
    if (response.access && response.refresh) {
      tokenStore.set({ access: response.access, refresh: response.refresh })
      const me = await fetchMe()
      setUser(me)
    }
    return response
  }, [])

  const logout = useCallback(async () => {
    await apiLogout(tokenStore.refresh)
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      if (!tokenStore.access) {
        setLoading(false)
        return
      }
      try {
        const me = await fetchMe()
        if (active) setUser(me)
      } catch {
        // Token invalid / expired; refresh redirect handled by interceptor.
        if (active) tokenStore.clear()
      } finally {
        if (active) setLoading(false)
      }
    }

    bootstrap()

    const onUnauthorized = () => setUser(null)
    window.addEventListener('iqac:unauthorized', onUnauthorized)
    return () => {
      active = false
      window.removeEventListener('iqac:unauthorized', onUnauthorized)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAuthenticated: !!user, login, logout }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


