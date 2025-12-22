import { sanityClient } from '@/lib/sanity'

type Event = {
  _id: string
  title: string
  location: string
  date: string
  slug: { current: string }
}

export default async function HomePage() {
  const events: Event[] = await sanityClient.fetch(`
    *[_type == "event"] | order(date desc){
      _id,
      title,
      location,
      date,
      slug
    }
  `)

  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-3xl mx-auto text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl font-semibold text-gray-900 mb-4">
          Encuentra tus fotos del evento
        </h1>
        <p className="text-lg text-gray-600">
          Selecciona tu evento para comenzar
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {events.map(event => (
            <a
              key={event._id}
              href={`/evento/${event.slug.current}`}
              className="block rounded-xl border p-6 hover:shadow-lg transition"
            >
              <h2 className="text-xl font-semibold text-gray-900">
                {event.title}
              </h2>
              <p className="text-gray-600">{event.location}</p>
              <p className="text-sm text-gray-500">
                {new Date(event.date).toLocaleDateString()}
              </p>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}