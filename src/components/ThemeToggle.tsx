'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const saved = (localStorage.getItem('theme') as Theme | null)
    const initial =
      saved ??
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

    document.getElementById('admin-root')?.setAttribute('data-theme', initial)
    setTheme(initial)
  }, [])

  if (!mounted) return null

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.getElementById('admin-root')?.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  return (
    <button
      onClick={toggle}
      className="px-3 py-2 rounded-full border text-sm"
      aria-label="Cambiar tema"
    >
      {theme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}
    </button>
  )
}
