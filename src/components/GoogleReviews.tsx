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

  if (loading) return <div className="text-sm text-gray-500">Carregando avaliações…</div>

  if (!data || data.error) {
    return <div className="text-sm text-gray-500">Não foi possível carregar as avaliações.</div>
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 text-gray-900">
      <h2 className="text-2xl font-semibold mb-2 text-gray-900">Opiniões</h2>

      <div className="text-sm text-gray-600 mb-6">
        <span className="font-medium text-gray-900">{data.name}</span>
        {data.rating != null && (
          <>
            {' '}
            · ⭐ {data.rating}
            {data.total != null ? ` (${data.total})` : ''}
          </>
        )}
      </div>

      {/* MOBILE: carrusel */}
      <div className="-mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
        {data.reviews.map((r, i) => (
          <div key={i} className="snap-start min-w-[85%] md:min-w-[48%] lg:min-w-[32%] border rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-900">{r.author}</div>
              <div className="text-sm text-gray-900">⭐ {r.rating}</div>
            </div>
            {r.time && <div className="text-xs text-gray-500 mb-2">{r.time}</div>}
            {r.text && <p className="text-sm text-gray-700">{r.text}</p>}
          </div>
        ))}
      </div>

    </section>
  )
}
