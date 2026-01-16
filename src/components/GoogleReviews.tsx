'use client'

import { useEffect, useState } from 'react'

type Review = {
  author: string
  rating: number
  text: string
  time: string
}

type ReviewsPayload = {
  name: string
  rating: number | null
  total: number | null
  reviews: Review[]
  error?: string
}

export default function GoogleReviews() {
  const [data, setData] = useState<ReviewsPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/google/reviews')
        const json = (await res.json()) as ReviewsPayload
        setData(json)
      } catch (e) {
        setData({ name: '', rating: null, total: null, reviews: [], error: 'fetch_failed' })
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="text-sm text-gray-500">Cargando opiniones…</div>

  if (!data || data.error) {
    return <div className="text-sm text-gray-500">No se pudieron cargar las opiniones.</div>
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-10">
      <h2 className="text-2xl font-semibold mb-2">Opiniones</h2>

      <div className="text-sm text-gray-600 mb-6">
        <span className="font-medium">{data.name}</span>
        {data.rating != null && (
          <>
            {' '}
            · ⭐ {data.rating}
            {data.total != null ? ` (${data.total})` : ''}
          </>
        )}
      </div>

      <div className="space-y-4">
        {data.reviews.map((r, i) => (
          <div key={i} className="border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">{r.author}</div>
              <div className="text-sm">⭐ {r.rating}</div>
            </div>
            {r.time && <div className="text-xs text-gray-500 mb-2">{r.time}</div>}
            {r.text && <p className="text-sm text-gray-700">{r.text}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
