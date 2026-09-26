import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              We're sorry, but an unexpected error occurred. Please try refreshing the page.
            </p>
            <details style={styles.details}>
              <summary>Error details</summary>
              <pre style={styles.pre}>{this.state.error?.message}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={styles.button}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
    background: 'var(--bg)',
  },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: 32,
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    boxShadow: 'var(--shadow-lg)',
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 },
  message: { color: 'var(--muted)', marginBottom: 24, lineHeight: 1.5 },
  details: { textAlign: 'left', marginBottom: 24 },
  pre: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 12,
    fontSize: 12,
    overflow: 'auto',
    maxHeight: 200,
    color: 'var(--muted)',
  },
  button: {
    background: 'var(--brand)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background .15s ease, transform .05s ease',
  },
};

export default ErrorBoundary;