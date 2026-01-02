'use client'

import Link from 'next/link'

export default function Header() {
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
            onClick={() => alert('Menú (próximamente)')}
          >
            Menú
          </button>

          <button
            type="button"
            aria-label="Buscar"
            className="hover:text-black"
            onClick={() => alert('Búsqueda (próximamente)')}
          >
            🔍
          </button>
        </nav>
      </div>
    </header>
  )
}
