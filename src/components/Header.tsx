'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'


type EventRow = {
  id: string
  name: string
  slug: string
  event_date: string | null
  location: string | null
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<EventRow[]>([])
  const router = useRouter()
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // cargar eventos una vez
  useEffect(() => {
    fetch('/api/admin/list-events', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
  }, [])

  // cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results =
    query.trim() === ''
      ? []
      : events.filter((ev) =>
          [ev.name, ev.location]
            .filter(Boolean)
            .some((v) =>
              v!.toLowerCase().includes(query.toLowerCase())
            )
        )

  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* IZQUIERDA */}
        <div className="flex items-center gap-6">
          <Link href="/" className="inline-flex items-center" aria-label="Ir al inicio">
            <Image
              src="/logo.png"
              alt="Ziza"
              width={140}
              height={40}
              priority
            />
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
        <div ref={boxRef} className="border-t bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <input
              type="search"
              placeholder="Buscar eventos…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full border rounded px-3 py-2 text-base"
              autoFocus
            />

            {/* RESULTADOS */}
            {query && (
              <div className="mt-2 border rounded bg-white shadow-sm max-h-64 overflow-auto">
                {results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    Sin resultados
                  </div>
                ) : (
                  results.slice(0, 5).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => {
                        if (!ev.slug) return
                        router.push(`/evento/${ev.slug}`)
                        setOpen(false)
                        setQuery('')
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                    >
                      <div className="font-medium">{ev.name}</div>
                      <div className="text-xs text-gray-500">
                        {[ev.event_date, ev.location].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
