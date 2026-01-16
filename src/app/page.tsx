'use client'
import { useEffect, useRef, useState } from 'react'
import GoogleReviews from '@/components/GoogleReviews'

import Image from 'next/image'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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
      className="block overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
    >
      {/* Imagen */}
      <div className="relative h-56">
        <Image
          src={event.image_url || '/hero.jpg'}
          alt={event.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Info debajo de la imagen */}
      <div className="p-5">
        <h3 className="text-lg font-semibold leading-tight mb-2 text-gray-900">
          {event.name}
        </h3>

        <div className="text-sm text-gray-600 space-y-1 mb-4">
          <div className="flex items-center gap-2">
            📍 <span>{event.location}</span>
          </div>

          <div className="flex items-center gap-2">
            📅 <span>{event.event_date}</span>
          </div>
        </div>

        <span className="inline-block rounded-full bg-[#f6f3ee] px-4 py-2 text-sm text-gray-900">
          Encontrar mis fotos →
        </span>
      </div>
    </Link>
  )
}

function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)]">
      <div className="h-56 bg-gray-200 animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse" />
        <div className="h-8 bg-gray-200 rounded-full w-32 animate-pulse mt-4" />
      </div>
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

  useEffect(() => {
    fetch('/api/admin/list-events')
      .then((res) => res.json())
      .then((data) => {
        const list = (data.events ?? [])
          .sort(
            (a: EventRow, b: EventRow) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 6)

        setEvents(list)
        setLoadingEvents(false)
      })
  }, [])

  return (
    <main className="w-full bg-[#f6f3ee]">
      {/* HERO */}
      <section className="relative h-[80vh] flex items-center justify-center text-center text-white">
        <video
          ref={heroRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onEnded={(e) => {
            const v = e.currentTarget
            v.currentTime = 0
            v.play().catch(() => {})
          }}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Overlay SIN blur (para que no se vea borroso) */}
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 max-w-3xl px-6">
          <h1 className="text-4xl sm:text-5xl font-semibold mb-6 tracking-wide">
            Explora tus recuerdos de eventos
          </h1>

          <p className="text-lg text-gray-200 mb-8">
            Sube una selfie y descubre todas las fotos donde apareces
          </p>

          {/* Buscador visual (el real está en el Header) */}
          <div className="mx-auto max-w-xl bg-white rounded-full px-6 py-4 text-gray-500 text-left shadow-lg">
            Buscar evento…
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f6f3ee]" />
      </section>

      {/* ÚLTIMOS EVENTOS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold mb-1">
          Últimos eventos
        </h2>
        <p className="text-center text-gray-600 mb-14">
          Encuentra tus fotos en estos eventos:
        </p>

        {loadingEvents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-gray-500">
            Aún no hay eventos publicados.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
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
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-12 text-gray-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold mb-3">
              Redes sociales
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>Instagram</li>
              <li>TikTok</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">
              Info contacto
            </h3>
            <p className="text-gray-600">
              contacto@ziza.cl
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
//dadada