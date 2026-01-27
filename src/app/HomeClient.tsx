'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import GoogleReviews from '@/components/GoogleReviews'
import { DayPicker } from "react-day-picker";

import Image from 'next/image'
import Link from 'next/link'

type EventRow = {
  id: string
  name: string
  slug: string
  event_date: string | null
  location: string | null
  image_url: string | null
  created_at: string
}

function EventCard({ event }: { event: EventRow }) {
  return (
    <Link
      href={`/evento/${event.slug}`}
      className="group relative block overflow-hidden rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.14)]"
    >
      {/* Imagen */}
      <div className="relative aspect-square w-full">
        <Image
          src={event.image_url || "/hero.jpg"}
          alt={event.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          unoptimized
        />

        {/* Oscurecer portada (como tonomaraca) */}
        <div className="absolute inset-0 bg-black/35" />

        {/* Gradiente para que el texto siempre se lea */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        {/* Texto sobre la imagen */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="text-xl font-semibold leading-tight drop-shadow-sm">
            {event.name}
          </h3>

          <div className="mt-3 space-y-2 text-sm text-white/90">
            {event.location && (
              <div className="flex items-center gap-2">
                <span className="opacity-95">📍</span>
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {event.event_date && (
              <div className="flex items-center gap-2">
                <span className="opacity-95">📅</span>
                <span className="truncate">{event.event_date}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-gray-200 animate-pulse shadow-[0_20px_40px_rgba(0,0,0,0.10)]">
      <div className="aspect-square w-full bg-gray-300" />
    </div>
  )
}

export default function HomePage() {

  const heroRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = heroRef.current
    if (!v) return

    // intenta autoplay inmediato
    v.muted = true
    v.play().catch(() => {})

    // fallback: si algún navegador móvil lo bloquea, arranca al primer toque
    const tryPlay = () => v.play().catch(() => {})
    window.addEventListener('touchstart', tryPlay, { once: true })
    window.addEventListener('click', tryPlay, { once: true })

    return () => {
      window.removeEventListener('touchstart', tryPlay)
      window.removeEventListener('click', tryPlay)
    }
  }, [])

  const [events, setEvents] = useState<EventRow[]>([])

  const [loadingEvents, setLoadingEvents] = useState(true)

    // =========================
    // BUSCA (nome + data)
    // =========================
    const [qName, setQName] = useState('')
    const [nameOpen, setNameOpen] = useState(false)

    const [calendarOpen, setCalendarOpen] = useState(false)
    const [dateSelected, setDateSelected] = useState<Date | undefined>(undefined)
    const [dateMsg, setDateMsg] = useState<string | null>(null)

    const nameBoxRef = useRef<HTMLDivElement | null>(null)
    const dateBoxRef = useRef<HTMLDivElement | null>(null)

    const toDateKey = (d: Date) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    const parseEventDateKey = (eventDate: string | null) => {
      if (!eventDate) return null

      // YYYY-MM-DD
      const m = eventDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) return `${m[1]}-${m[2]}-${m[3]}`

      // DD/MM/YYYY
      const br = eventDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (br) return `${br[3]}-${br[2]}-${br[1]}`

      // fallback Date()
      const d = new Date(eventDate)
      if (Number.isNaN(d.getTime())) return null
      return toDateKey(d)
    }

    const availableDateKeys = useMemo(() => {
      const s = new Set<string>()
      for (const e of events) {
        const k = parseEventDateKey(e.event_date)
        if (k) s.add(k)
      }
      return s
    }, [events])

    const eventsSorted = useMemo(() => {
      // ya vienen ordenados desde el fetch, pero copiamos por seguridad
      return [...events]
    }, [events])

    const nameMatches = useMemo(() => {
      const q = qName.trim().toLowerCase()
      if (!q) return []
      return eventsSorted
        .filter(e => (e.name || '').toLowerCase().includes(q))
        .slice(0, 8)
    }, [qName, eventsSorted])

    const selectedDateKey = useMemo(() => {
      return dateSelected ? toDateKey(dateSelected) : null
    }, [dateSelected])

    const dateMatches = useMemo(() => {
      if (!selectedDateKey) return []
      return eventsSorted.filter(e => parseEventDateKey(e.event_date) === selectedDateKey)
    }, [eventsSorted, selectedDateKey])

    const filteredEvents = useMemo(() => {
      const q = qName.trim().toLowerCase()
      return eventsSorted.filter((e) => {
        const nameOk = !q || (e.name || '').toLowerCase().includes(q)
        const dateOk = !selectedDateKey || parseEventDateKey(e.event_date) === selectedDateKey
        return nameOk && dateOk
      })
    }, [eventsSorted, qName, selectedDateKey])

    const goToEvent = (slug: string) => {
      window.location.href = `/evento/${slug}`
    }

    const handleSelectDate = (d: Date | undefined) => {
      setDateSelected(d)

      if (!d) {
        setDateMsg(null)
        return
      }

      const key = toDateKey(d)
      const matches = eventsSorted.filter(e => parseEventDateKey(e.event_date) === key)

      if (matches.length === 1) {
        setDateMsg(null)
        setCalendarOpen(false)
        goToEvent(matches[0].slug)
        return
      }

      if (matches.length > 1) {
        setDateMsg('Há mais de um evento nessa data. Selecione abaixo.')
        setCalendarOpen(true)
        return
      }

      setDateMsg('Nenhum evento nessa data.')
      setCalendarOpen(true)
    }

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        const t = e.target as Node
        if (nameBoxRef.current && !nameBoxRef.current.contains(t)) setNameOpen(false)
        if (dateBoxRef.current && !dateBoxRef.current.contains(t)) setCalendarOpen(false)
      }
      document.addEventListener('mousedown', onDocClick)
      return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

  useEffect(() => {
    fetch('/api/admin/list-events')
      .then((res) => res.json())
      .then((data) => {
        const toTime = (s: string | null) => {
          if (!s) return 0

          // Soporta "YYYY-MM-DD" y también "DD/MM/YYYY"
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
            const [dd, mm, yyyy] = s.split('/')
            return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).getTime()
          }

          const t = new Date(s).getTime()
          return Number.isFinite(t) ? t : 0
        }

        const list = (data.events ?? [])
          .sort((a: EventRow, b: EventRow) => {
            const tb = toTime(b.event_date) || toTime(b.created_at)
            const ta = toTime(a.event_date) || toTime(a.created_at)
            return tb - ta
          })

        setEvents(list)
        setLoadingEvents(false)
      })
  }, [])

  return (
    <main className="w-full bg-[#f6f3ee] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-0">
      {/* HERO */}
      <section className="relative h-[80vh] flex items-center justify-center text-center text-white">
        <video
          ref={heroRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Overlay SIN blur (para que no se vea borroso) */}
        <div className="absolute inset-0 bg-black/30" />

        {/* LOGO sobre el video (abajo-izquierda) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
          <Image
            src="/logo.png"   // o el archivo que estés usando
            alt="Ziza Photography"
            width={180}
            height={60}
            priority
            className="h-auto w-[160px] sm:w-[190px] md:w-[220px]"
          />
        </div>

        {/* (removido: título/subtítulo del hero) */}

        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f6f3ee]" />
      </section>

      {/* BUSCADORES (debajo del video) */}
      <section className="mb-10">
        <div className="bg-white rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.10)] p-4 sm:p-5 text-gray-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Buscar por nome */}
            <div ref={nameBoxRef} className="relative">
              <label className="text-xs text-gray-500 block mb-1">
                Buscar por nome do evento
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-60">🔎</span>
                <input
                  value={qName}
                  onChange={(e) => {
                    setQName(e.target.value)
                    setNameOpen(true)
                  }}
                  onFocus={() => setNameOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nameMatches[0]) goToEvent(nameMatches[0].slug)
                  }}
                  placeholder="Buscar pelo nome do evento"
                  className="w-full border rounded-xl pl-10 pr-4 py-3 text-gray-900"
                />
              </div>

              {nameOpen && qName.trim() && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/10">
                  {nameMatches.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-600">
                      Nenhum evento encontrado.
                    </div>
                  ) : (
                    <ul className="max-h-72 overflow-auto">
                      {nameMatches.map((ev) => (
                        <li key={ev.id}>
                          <button
                            type="button"
                            onClick={() => goToEvent(ev.slug)}
                            className="w-full text-left px-4 py-3 hover:bg-black/5"
                          >
                            <div className="text-sm font-medium text-gray-900">{ev.name}</div>
                            <div className="text-xs text-gray-600">
                              {ev.location ? `📍 ${ev.location} · ` : ''}{ev.event_date ?? ''}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Buscar por data (calendário) */}
            <div ref={dateBoxRef} className="relative">
              <label className="text-xs text-gray-500 block mb-1">
                Buscar por data
              </label>

              <button
                type="button"
                onClick={() => setCalendarOpen(v => !v)}
                className="w-full border rounded-xl px-4 py-3 text-left bg-white text-gray-900"
              >
                {dateSelected ? `📅 ${toDateKey(dateSelected)}` : '📅 Selecionar data'}
              </button>

              {calendarOpen && (
                <div className="absolute right-0 mt-2 w-[340px] max-w-full bg-white border rounded-2xl shadow-lg p-3 z-50">
                  <DayPicker
                    mode="single"
                    selected={dateSelected}
                    onSelect={handleSelectDate}
                    disabled={(day) => !availableDateKeys.has(toDateKey(day))}
                  />

                  <div className="flex justify-between mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDateSelected(undefined)
                        setDateMsg(null)
                        setCalendarOpen(false)
                      }}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Limpar
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      className="text-sm text-gray-900 font-medium"
                    >
                      Fechar
                    </button>
                  </div>

                  {dateMsg && (
                    <p className="text-xs text-gray-500 mt-2">{dateMsg}</p>
                  )}

                  {dateSelected && dateMatches.length > 1 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-xs text-gray-500 mb-2">
                        Selecione o evento:
                      </p>
                      <div className="space-y-2">
                        {dateMatches.map(ev => (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => goToEvent(ev.slug)}
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-black/5"
                          >
                            <div className="text-sm font-medium text-gray-900">{ev.name}</div>
                            <div className="text-xs text-gray-600">
                              {ev.location ? `📍 ${ev.location}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {(qName.trim() || dateSelected) && (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Mostrando resultados filtrados
              </p>
              <button
                type="button"
                onClick={() => {
                  setQName('')
                  setDateSelected(undefined)
                  setDateMsg(null)
                }}
                className="text-xs text-gray-900 font-medium hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ÚLTIMOS EVENTOS */}
      <section className="w-full px-6 md:px-12 py-10 text-gray-900">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold mb-1 text-gray-900">
          Últimos eventos
        </h2>
        <p className="text-center text-gray-600 mb-14">
          Encontre suas fotos nestes eventos:
        </p>

        {loadingEvents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <p className="text-center text-gray-500">
            Ainda não há eventos publicados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredEvents.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* BLOQUE DE RESPIRO */}
      <section className="bg-yellow-50 border-t border-b">
        {/* REVIEWS */}
        <GoogleReviews />
      </section>

      {/* FOOTER */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#f6f3ee] border-t md:static md:border-0">
        <div className="w-full px-6 md:px-12 py-2 md:py-12 text-gray-900">
          <div className="flex items-center justify-between md:items-start">
            {/* Redes sociais */}
            <div className="flex items-center gap-3 md:flex md:flex-col md:items-start">
              <h3 className="hidden md:block font-semibold mb-3">Redes sociais</h3>

              <ul className="flex items-center gap-3 text-gray-600">
                <li>
                  <a
                    href={"https://www.instagram.com/zizaphotography"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Instagram"
                    className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" fill="currentColor">
                      <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9Zm10.25 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
                    </svg>
                  </a>
                </li>

                <li>
                  <a
                    href={"https://web.facebook.com/zizaphotography"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Facebook"
                    className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" fill="currentColor">
                      <path d="M13.5 22v-8h2.5l.5-3h-3V9.5c0-.9.3-1.5 1.6-1.5H16.7V5.1c-.3 0-1.4-.1-2.7-.1-2.7 0-4.5 1.6-4.5 4.6V11H7v3h2.5v8h4Z" />
                    </svg>
                  </a>
                </li>

                <li>
                  <a
                    href={"https://www.youtube.com/@Zizaphotography"}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="YouTube"
                    className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 md:h-6 md:w-6" fill="currentColor">
                      <path d="M21.6 7.2a3 3 0 0 0-2.12-2.12C17.9 4.6 12 4.6 12 4.6s-5.9 0-7.48.48A3 3 0 0 0 2.4 7.2 31.6 31.6 0 0 0 2 12s.1 3.1.4 4.8a3 3 0 0 0 2.12 2.12c1.58.48 7.48.48 7.48.48s5.9 0 7.48-.48a3 3 0 0 0 2.12-2.12c.3-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.3V8.7L15.8 12 10 15.3Z" />
                    </svg>
                  </a>
                </li>
              </ul>
            </div>

            {/* Contato */}
            <div className="text-right">
              <h3 className="hidden md:block font-semibold mb-3">Contato</h3>
              <a href="mailto:zizaphotography.com.br@gmail.com" className="text-xs md:text-base text-gray-600 hover:underline">
                zizaphotography.com.br@gmail.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
//dadada