/**
 * Overlay/Toast/Confirm types
 */

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  kind: ToastKind
  message: string
  actionLabel?: string
  onAction?: () => void
  leaving?: boolean
}

export interface ConfirmOpts {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  /** Require the user to type `word` before the destructive button unlocks */
  needType?: boolean
  word?: string
}

export interface ToastApi {
  success: (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

export interface ToastContextValue {
  push: (t: Omit<ToastItem, 'id'>) => void
}

export interface ConfirmContextValue {
  ask: (opts: ConfirmOpts) => Promise<boolean>
}