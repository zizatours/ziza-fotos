'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  const apply = (t: Theme) => {
    const root = document.getElementById('admin-root')
    if (!root) return

    // ✅ esto es lo que activa tus dark:* dentro del admin
    root.classList.toggle('dark', t === 'dark')

    // (opcional, pero útil para inputs nativos / scrollbars)
    root.setAttribute('data-theme', t)
    ;(root as HTMLElement).style.colorScheme = t
  }

  useEffect(() => {
    setMounted(true)

    const saved = localStorage.getItem('theme') as Theme | null
    const initial =
      saved ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    apply(initial)
    setTheme(initial)
  }, [])

  if (!mounted) return null

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    apply(next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="px-3 py-2 rounded-full border text-sm
                 bg-white text-black border-black/15
                 dark:bg-white/10 dark:text-white dark:border-white/20"
      aria-label="Cambiar tema"
      type="button"
    >
      {theme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
    </button>
  )
}
