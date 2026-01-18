'use client'

import { useEffect } from 'react'

export default function ClientErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      fetch('/api/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          message: event.message,
          stack: (event.error && (event.error as any).stack) || null,
          href: window.location.href,
          ua: navigator.userAgent,
        }),
      }).catch(() => {})
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      fetch('/api/log-client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'unhandledrejection',
          message: String(event.reason),
          href: window.location.href,
          ua: navigator.userAgent,
        }),
      }).catch(() => {})
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
