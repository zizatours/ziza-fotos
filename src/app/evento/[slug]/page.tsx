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
    .select('name, location, event_date')
    .eq('slug', slug)
    .single()

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Evento no encontrado</p>
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

          <p className="text-lg text-gray-200">
            Sube una selfie y encuentra solo tus fotos
          </p>
        </div>
      </section>

      {/* INFO */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <span>📍 {event.location}</span>
          <span>
            📅 {event.event_date
              ? new Date(event.event_date).toLocaleDateString()
              : ''}
          </span>

          <span>📸 Fotos oficiales</span>
        </div>
      </section>

      {/* SELFIE CARD (solo UI por ahora) */}
      <section className="max-w-md mx-auto px-6 pb-24">
        <SelfieUploader eventSlug={slug} />
      </section>
    </main>
  )
}