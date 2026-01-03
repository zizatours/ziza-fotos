'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [open, setOpen] = useState(false)

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* IZQUIERDA */}
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg">
            Logo
          </Link>

          <Link href="/" className="text-sm text-gray-700 hover:text-black">
            Inicio
          </Link>
        </div>

        {/* DERECHA */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-sm text-gray-700 hover:text-black"
          aria-label="Buscar"
        >
          🔍
        </button>
      </div>

      {open && (
        <div className="border-t bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <input
              type="text"
              placeholder="Buscar eventos…"
              className="w-full border rounded px-3 py-2"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  )
}
