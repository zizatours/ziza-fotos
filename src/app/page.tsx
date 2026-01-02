import Image from 'next/image'
import Link from 'next/link'
import { createPublicClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type EventRow = {
  id: string
  name: string
  slug: string
  date: string | null
  location: string | null
  image_url: string | null
  created_at: string
}

async function getLatestEvents(): Promise<EventRow[]> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
  .from('events')
  .select('*')
  .order('event_date', { ascending: false })
  .limit(9)

  if (error) {
    console.error('Error loading events:', error)
    return []
  }

  return data ?? []
}

function EventCard({ event }: { event: EventRow }) {
  return (
    <Link
      href={`/evento/${event.slug}`}
      className="group block"
      prefetch={false}
    >
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="relative aspect-[4/3] bg-gray-100">
          {event.image_url ? (
            <Image
              src={event.image_url}
              alt={event.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Sin imagen
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="font-medium leading-tight line-clamp-2">
            {event.name}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {[event.date, event.location].filter(Boolean).join(' · ')}
          </div>
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
      className="relative block h-[220px] sm:h-[260px] rounded-2xl overflow-hidden group"
      prefetch={false}
    >
      <div className="absolute inset-0 bg-black/40 z-10" />
      <Image
        src="/hero.jpg"
        alt={title}
        fill
        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-white text-center px-6">
        <h3 className="text-3xl sm:text-4xl font-semibold">
          {title}
        </h3>
        <p className="mt-1 text-sm sm:text-base text-white/90">
          {subtitle}
        </p>
        <span className="mt-4 inline-block border border-white/50 rounded-full px-4 py-2 text-sm">
          Ver eventos →
        </span>
      </div>
    </Link>
  )
}

export default async function HomePage() {
  const events = await getLatestEvents()

  return (
    <main className="w-full">
      {/* HERO */}
      <section className="border-b">
        <div className="relative h-[240px] sm:h-[340px] md:h-[440px]">
          <Image
            src="/hero.jpg"
            alt="Ziza Fotos"
            fill
            priority
            className="object-cover"
          />
        </div>
        <p className="text-center py-6 text-gray-700">
          Encuentra tus fotos de eventos en segundos 📸
        </p>
      </section>

      {/* ÚLTIMOS EVENTOS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h2 className="text-center text-2xl sm:text-3xl font-semibold mb-6">
          Últimos eventos
        </h2>

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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
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
