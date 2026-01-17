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
          Encontrar minhas fotos →
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
            Explore suas memórias de eventos
          </h1>

          <p className="text-lg text-gray-200 mb-8">
            Envie uma selfie e descubra todas as fotos em que você aparece
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#f6f3ee]" />
      </section>

      {/* ÚLTIMOS EVENTOS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold mb-1">
          Últimos eventos
        </h2>
        <p className="text-center text-gray-600 mb-14">
          Encontre suas fotos nestes eventos:
        </p>

        {loadingEvents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="text-center text-gray-500">
            Ainda não há eventos publicados.
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
            <h3 className="font-semibold mb-3">Redes sociais</h3>

            <ul className="flex items-center gap-4 text-gray-600">
              <li>
                <a
                  href={"https://www.instagram.com/zizaphotography"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 transition"
                >
                  {/* Instagram icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
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
                  {/* Facebook icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
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
                  {/* YouTube icon */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
                    <path d="M21.6 7.2a3 3 0 0 0-2.12-2.12C17.9 4.6 12 4.6 12 4.6s-5.9 0-7.48.48A3 3 0 0 0 2.4 7.2 31.6 31.6 0 0 0 2 12s.1 3.1.4 4.8a3 3 0 0 0 2.12 2.12c1.58.48 7.48.48 7.48.48s5.9 0 7.48-.48a3 3 0 0 0 2.12-2.12c.3-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.3V8.7L15.8 12 10 15.3Z" />
                  </svg>
                </a>
              </li>

              <li>
                <a
                  href="https://www.google.com/maps/place/Ziza+Tours/@-22.0582336,-44.2428833,8z/data=!3m1!4b1!4m6!3m5!1s0x948854da284acb3:0x8137f5f1960b463!8m2!3d-22.0660686!4d-42.9236307!16s%2Fg%2F11ysbwn3vr?entry=ttu&g_ep=EgoyMDI2MDExMy4wIKXMDSoASAFQAw%3D%3D"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Avaliações no Google"
                  className="inline-flex items-center justify-center rounded-lg p-2 hover:bg-black/5 transition"
                >
                  {/* Google "G" icon (monocromo para que combine con el resto) */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="currentColor"
                  >
                    <path d="M12 10.2v3.6h5.02c-.22 1.3-1.5 3.82-5.02 3.82a5.98 5.98 0 0 1 0-11.96c1.74 0 2.9.74 3.56 1.38l2.42-2.33C16.58 3.33 14.47 2.4 12 2.4 6.92 2.4 2.8 6.52 2.8 11.6S6.92 20.8 12 20.8c6.92 0 8.6-4.86 8.6-7.38 0-.5-.06-.88-.14-1.22H12Z" />
                  </svg>
                </a>
              </li>

            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Contato</h3>

            <a
              href="mailto:zizadrone@gmail.com"
              className="text-gray-600 hover:underline"
            >
              zizadrone@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
//dadada