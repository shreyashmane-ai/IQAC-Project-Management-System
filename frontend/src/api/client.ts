import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { TokenPair } from '../types'

const ACCESS_KEY = 'iqac_access'
const REFRESH_KEY = 'iqac_refresh'

export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(pair: TokenPair) {
    localStorage.setItem(ACCESS_KEY, pair.access)
    if (pair.refresh) localStorage.setItem(REFRESH_KEY, pair.refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh the access token when it expires, then retry once.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.refresh
  if (!refresh) throw new Error('No refresh token available')

  const { data } = await axios.post<TokenPair>('/api/v1/auth/refresh/', {
    refresh,
  })
  tokenStore.set(data)
  return data.access
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined

    const isAuthCall =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/me')

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthCall &&
      tokenStore.refresh
    ) {
      original._retry = true
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken()
        const access = await refreshPromise
        refreshPromise = null
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch (refreshError) {
        refreshPromise = null
        tokenStore.clear()
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('iqac:unauthorized'))
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

function stringifyMessages(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    return value.map(stringifyMessages).filter(Boolean).join(', ')
  }
  return null
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Record<string, unknown> | string | undefined
    if (data) {
      // Backend envelope: { error: { code, message, fieldErrors } }
      if (typeof data === 'object' && typeof data.error === 'object' && data.error !== null) {
        const env = data.error as Record<string, unknown>
        const message = stringifyMessages(env.message)
        const fieldErrors = env.fieldErrors as Record<string, unknown> | undefined
        if (fieldErrors && typeof fieldErrors === 'object') {
          const parts: string[] = []
          for (const [field, msgs] of Object.entries(fieldErrors)) {
            const text = stringifyMessages(msgs)
            if (text) parts.push(`${field}: ${text}`)
          }
          if (parts.length) return parts.join(' · ')
        }
        if (message) return message.charAt(0).toUpperCase() + message.slice(1)
      }
      if (typeof data === 'string') return data
      if (typeof data.detail === 'string') return data.detail.charAt(0).toUpperCase() + (data.detail as string).slice(1)
      const firstKey = Object.keys(data)[0]
      if (firstKey) {
        const message = stringifyMessages(data[firstKey])
        if (message) return message
      }
    }
  }
  return fallback
}

/**
 * Creates a cancellable request wrapper.
 * Returns { cancel(): void, promise: Promise<T> }
 */
export function cancellableRequest<T>(requestFn: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController()
  const signal = controller.signal
  const promise = requestFn(signal).catch((err) => {
    if (err.name === 'AbortError' || signal.aborted) {
      return Promise.reject({ name: 'AbortError', message: 'Request cancelled' })
    }
    throw err
  })

  return {
    cancel: () => controller.abort(),
    promise,
  }
}

/**
 * Hook-friendly cancellable request that works with axios cancel tokens
 * (for compatibility with older axios-based code)
 */
export function createCancelToken() {
  const source = axios.CancelToken.source()
  return {
    token: source.token,
    cancel: (message?: string) => source.cancel(message),
  }
}

export default api
