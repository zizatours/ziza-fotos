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

  // Ordenamos por largo (primero el más largo)
  const reviewsSorted = [...data.reviews].sort((a, b) => {
    const la = (a.text || '').length
    const lb = (b.text || '').length
    return lb - la
  })

  // 1 review “destacada” (la más larga) + el resto
  const featured = reviewsSorted[0]
  const rest = reviewsSorted.slice(1)

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 text-gray-900">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Deixe seu comentário</h2>

          <div className="text-sm text-gray-600 mt-2">
            <span className="font-medium text-gray-900">{data.name}</span>
            {data.rating != null && (
              <>
                {' '}
                · ⭐ {data.rating}
                {data.total != null ? ` (${data.total})` : ''}
              </>
            )}
          </div>
        </div>

        {/* ✅ BOTÓN “Avaliar no Google” al lado del título (zona verde) */}
        <a
          href="https://www.google.com/maps/place/Ziza+Tours/@-22.0582336,-44.2428833,8z/data=!3m1!4b1!4m6!3m5!1s0x948854da284acb3:0x8137f5f1960b463!8m2!3d-22.0660686!4d-42.9236307!16s%2Fg%2F11ysbwn3vr"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-900 hover:bg-black/5"
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

      {/* 1) DESTACADO (el más largo) */}
      {featured && featured.text && (
        <div className="hidden md:block mb-6 border rounded-2xl p-5 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-gray-900">{featured.author}</div>
            <div className="text-sm text-gray-900">⭐ {featured.rating}</div>
          </div>
          {featured.time && <div className="text-xs text-gray-500 mb-2">{featured.time}</div>}
          <p className="text-sm text-gray-700">{featured.text}</p>
        </div>
      )}

      {/* 2) MOBILE: carrusel (todos, ordenados) */}
      <div className="md:hidden -mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2">
        {reviewsSorted.map((r, i) => (
          <div key={i} className="snap-start min-w-[85%] border rounded-xl p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-900">{r.author}</div>
              <div className="text-sm text-gray-900">⭐ {r.rating}</div>
            </div>
            {r.time && <div className="text-xs text-gray-500 mb-2">{r.time}</div>}
            {r.text && <p className="text-sm text-gray-700">{r.text}</p>}
          </div>
        ))}
      </div>

      {/* 3) DESKTOP: “colunas” (cortos se apilan) */}
      <div className="hidden md:block">
        <div className="columns-2 lg:columns-3 gap-4">
          {rest.map((r, i) => (
            <div key={i} className="mb-4 break-inside-avoid border rounded-xl p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-900">{r.author}</div>
                <div className="text-sm text-gray-900">⭐ {r.rating}</div>
              </div>
              {r.time && <div className="text-xs text-gray-500 mb-2">{r.time}</div>}
              {r.text && <p className="text-sm text-gray-700">{r.text}</p>}
            </div>
          ))}
        </div>
      </div>

    </section>
  )
}
