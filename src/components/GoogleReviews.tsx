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
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-2xl font-semibold text-gray-900">Deixe seu comentário</h2>

        <a
          href="https://www.google.com/maps/place/Ziza+Tours/@-22.0582336,-44.2428833,8z/data=!3m1!4b1!4m6!3m5!1s0x948854da284acb3:0x8137f5f1960b463!8m2!3d-22.0660686!4d-42.9236307!16s%2Fg%2F11ysbwn3vr?entry=ttu&g_ep=EgoyMDI2MDExMy4wIKXMDSoASAFQAw%3D%3D"
          target="_blank"
          rel="noreferrer"
          aria-label="Avaliações no Google"
          className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-800 hover:bg-black/5 transition whitespace-nowrap"
        >
          Avaliar no Google
        </a>
      </div>

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
