import { sanityClient } from '@/lib/sanity'
import { useEffect, useState } from 'react'

type Event = {
  _id: string
  title: string
  location: string
  date: string
  description: string
  cover_image: {
    asset: {
      url: string
    }
  }
}

export default function EventPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<Event | null>(null)

  useEffect(() => {
    async function fetchEvent() {
      const data = await sanityClient.fetch(
        `*[_type == "event" && slug.current == $slug][0]`,
        { slug: params.slug }
      )
      setEvent(data)
    }

    fetchEvent()
  }, [params.slug])

  if (!event) return <div>Loading...</div>

  return (
    <div>
      <h1>{event.title}</h1>
      <p>{event.location}</p>
      <p>{new Date(event.date).toLocaleDateString()}</p>
      <p>{event.description}</p>
      <img
        src={event.cover_image.asset.url}
        alt={event.title}
        className="w-full h-48 object-cover"
      />
    </div>
  )
}
