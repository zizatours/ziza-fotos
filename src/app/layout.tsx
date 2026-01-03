'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const handleChange = (v: string) => {
    setValue(v)
    window.dispatchEvent(
      new CustomEvent('search-events', { detail: v })
    )
  }

  return (
    <header className="w-full border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* LOGO */}
        <Link href="/" className="font-semibold text-lg">
          Logo
        </Link>

        {/* NAV */}
        <nav className="flex items-center gap-6 text-sm text-gray-700">
          <Link href="/" className="hover:text-black">
            Inicio
          </Link>

          <button
            type="button"
            className="hover:text-black"
            onClick={() => setOpen((v) => !v)}
          >
            🔍
          </button>
        </nav>
      </div>

      {open && (
        <div className="border-t bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
            <input
              type="text"
              placeholder="Buscar eventos…"
              value={value}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full border rounded px-3 py-2"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  )
}
