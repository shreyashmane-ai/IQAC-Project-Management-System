import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import type { ToastItem, ConfirmOpts, ToastContextValue, ConfirmContextValue, ToastApi } from '../utils/overlay'

const ToastCtx = createContext<ToastContextValue | null>(null)
const ConfirmCtx = createContext<ConfirmContextValue | null>(null)

let nextId = 1

const TOAST_ICONS: Record<ToastItem['kind'], ReactNode> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '⚠',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 220)
  }, [])

  const push = useCallback(
    (t: Omit<ToastItem, 'id'>) => {
      const id = nextId++
      setToasts((list) => [...list, { ...t, id }])
      window.setTimeout(() => dismiss(id), t.actionLabel ? 6500 : 4200)
    },
    [dismiss],
  )

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.leaving ? 'slide-out' : ''}`}>
            <span className={`toast-icon ${t.kind}`}>{TOAST_ICONS[t.kind]}</span>
            <div className="toast-body">{t.message}</div>
            {t.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.onAction?.()
                  dismiss(t.id)
                }}
              >
                {t.actionLabel}
              </button>
            )}
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [typed, setTyped] = useState('')
  const [prevState, setPrevState] = useState(state)

  if (prevState !== state) {
    setPrevState(state)
    if (state) setTyped('')
  }

  const word = (state?.word || 'delete').trim().toLowerCase()

  const ask = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => {
        setState({ ...opts, resolve })
      }),
    [],
  )

  const close = useCallback((value: boolean) => {
    setState((s) => {
      if (!s) return s
      s.resolve(value)
      return null
    })
  }, [])

  useEffect(() => {
    if (!state) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, close])

  const needType = state?.needType ?? false
  const unlocked = !needType || typed.trim().toLowerCase() === word

  return (
    <ConfirmCtx.Provider value={{ ask }}>
      {children}
      {state && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close(false)
          }}
        >
          <div className={`modal ${state.danger ? 'modal--danger' : ''}`} role="dialog" aria-modal="true" aria-label={state.title}>
            <div className="modal-head">
              <span className={`modal-mark ${state.danger ? 'danger' : ''}`}>{state.danger ? '!' : '?'}</span>
              <h3>{state.title}</h3>
            </div>
            {state.body && <p className="modal-sub">{state.body}</p>}
            {needType && (
              <div className="modal-field">
                <label className="modal-field-label">
                  Type <b>{word}</b> to confirm
                </label>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={word}
                />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => close(false)}>
                {state.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn ${state.danger ? 'danger' : 'primary'}`}
                disabled={!unlocked}
                onClick={() => close(true)}
              >
                {state.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  const push = ctx.push
  return {
    success: useCallback(
      (message: string, opts?: { actionLabel?: string; onAction?: () => void }) => push({ kind: 'success', message, actionLabel: opts?.actionLabel, onAction: opts?.onAction }),
      [push],
    ),
    error: useCallback((message: string) => push({ kind: 'error', message }), [push]),
    info: useCallback((message: string) => push({ kind: 'info', message }), [push]),
    warning: useCallback((message: string) => push({ kind: 'warning', message }), [push]),
  }
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.ask
}