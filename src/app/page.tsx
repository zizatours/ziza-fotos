'use client'
import { useEffect, useState } from 'react'

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
    <Link href={`/evento/${event.slug}`} className="group">
      <div className="rounded-3xl overflow-hidden bg-white shadow-[0_24px_48px_rgba(0,0,0,0.10)]">
        {/* Imagen */}
        <div className="relative h-64">
          <Image
            src={event.image_url || '/hero.jpg'}
            alt={event.name}
            fill
            className="object-cover brightness-95"
          />
        </div>

        {/* Texto */}
        <div className="p-6">
          <h3 className="text-lg font-medium mb-1">
            {event.name}
          </h3>

          <p className="text-sm text-gray-600 mb-4">
            {event.location} · {event.event_date}
          </p>

          <span className="inline-block rounded-full bg-[#f6f3ee] px-4 py-2 text-sm">
            Encontrar mis fotos →
          </span>
        </div>
      </div>
    </Link>
  )
}

function CategoryBanner({
  title,
  subtitle,
  href,
}: {
  title: string
  subtitle: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group relative block h-[260px] rounded-3xl overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.12)]"
      prefetch={false}
    >
      {/* Imagen */}
      <Image
        src="/hero.jpg"
        alt={title}
        fill
        className="object-cover brightness-90 group-hover:brightness-100 transition"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Contenido */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-white text-center px-6">
        <h3 className="text-3xl sm:text-4xl font-light mb-3">
          {title}
        </h3>

        <span className="rounded-full bg-white/90 px-5 py-2 text-sm text-gray-800 shadow">
          {subtitle} →
        </span>
      </div>
    </Link>
  )
}

export default function HomePage() {

  const [events, setEvents] = useState<EventRow[]>([])

  useEffect(() => {
    fetch('/api/admin/list-events', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const list = (data.events ?? [])
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 6)

        setEvents(list)
      })
  }, [])

  return (
    <main className="w-full bg-[#f6f3ee]">
      {/* HERO */}
      <section className="relative h-[80vh] flex items-center justify-center text-center text-white">
        <Image
          src="/hero.jpg"
          alt="Ziza Fotos"
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

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

        {events.length === 0 ? (
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

      {/* CATEGORÍAS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 mt-8 space-y-8">
        <CategoryBanner
          title="Tours"
          subtitle="Explora fotos de tours"
          href="/"
        />
        <CategoryBanner
          title="Fiesta"
          subtitle="Momentos únicos para recordar"
          href="/"
        />
        <CategoryBanner
          title="Giras de estudio"
          subtitle="Recuerdos de tu generación"
          href="/"
        />
      </section>

      {/* BLOQUE DE RESPIRO */}
      <section className="bg-yellow-50 border-t border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <p className="text-center text-gray-700">
            Revive tus recuerdos cuando quieras ✨
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
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
