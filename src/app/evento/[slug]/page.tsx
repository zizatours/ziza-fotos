import { sanityClient } from '@/lib/sanity'
import SelfieUploader from './SelfieUploader'

type Event = {
  title: string
  location: string
  date: string
}

export default async function EventoPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const event: Event | null = await sanityClient.fetch(
    `*[_type == "event" && slug.current == "${slug}"][0]{
      title,
      location,
      date
    }`
  )

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
      <section
        className="relative h-[60vh] flex items-center justify-center text-center text-white"
        style={{
          backgroundImage:
            'url(https://images.unsplash.com/photo-1501281668745-f7f57925c3b4)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 px-6">
          <h1 className="text-4xl md:text-5xl font-semibold mb-4">
            {event.title}
          </h1>

          <p className="text-lg text-gray-200">
            Sube una selfie y encuentra tus fotos oficiales
          </p>
        </div>
      </section>

      {/* INFO */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <span>📍 {event.location}</span>
          <span>📅 {new Date(event.date).toLocaleDateString()}</span>
          <span>📸 Fotos oficiales</span>
        </div>
      </section>

      {/* SELFIE CARD (solo UI por ahora) */}
      <section className="max-w-md mx-auto px-6 pb-24">
        <SelfieUploader />
      </section>
    </main>
  )
}