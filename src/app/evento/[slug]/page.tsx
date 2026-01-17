import SelfieUploader from './SelfieUploader'
import { createPublicClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function EventoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = createPublicClient()

  const { data: event } = await supabase
    .from('events')
    .select('name, location, event_date, image_url')
    .eq('slug', slug)
    .single()

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Evento não encontrado</p>
      </main>
    )
  }

  return (
    <main className="bg-white min-h-screen">

      {/* HERO */}
      <section className="relative h-[70vh] flex items-center justify-center text-center text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${event.image_url ?? '/hero.jpg'})`,
          }}
        />

        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 max-w-3xl px-6">
          <h1 className="text-4xl sm:text-5xl font-semibold mb-4">
            {event.name}
          </h1>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-white/90 mt-2">
            <span>📍 {event.location}</span>
            <span>
              📅 {event.event_date
                ? new Date(event.event_date).toLocaleDateString()
                : ''}
            </span>
          </div>

        </div>
      </section>

      {/* SELFIE CARD */}
      <section className="max-w-6xl mx-auto px-6 pb-24 pt-8 text-center">
        <h2 className="text-lg font-medium mb-1 text-gray-900">
          Encontre suas fotos
        </h2>

        <SelfieUploader eventSlug={slug} />
      </section>
    </main>
  )
}