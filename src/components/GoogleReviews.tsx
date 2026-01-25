'use client'

import { useEffect, useMemo, useState } from 'react'

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

function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="border rounded-2xl p-5 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-gray-900">{r.author}</div>
        <div className="text-sm text-gray-900">⭐ {r.rating}</div>
      </div>
      {r.time && <div className="text-xs text-gray-500 mb-2">{r.time}</div>}
      {r.text && <p className="text-sm text-gray-700 whitespace-pre-line">{r.text}</p>}
    </div>
  )
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

  // Ordenamos por largo (primero el más largo) para que los “grandes” se vayan solos en columnas.
  const reviewsSorted = useMemo(() => {
    return [...(data.reviews || [])].sort((a, b) => (b.text || '').length - (a.text || '').length)
  }, [data.reviews])

  // 🔧 Ajusta este umbral si quieres que “largo” sea más/menos frecuente
  const LONG_THRESHOLD = 220

  // Empaquetado a columnas:
  // - Si es LARGO => columna con 1
  // - Si es corto/normal => se agrupan de a 2 por columna
  const columns: Review[][] = useMemo(() => {
    const out: Review[][] = []
    let pending: Review | null = null

    for (const r of reviewsSorted) {
      const len = (r.text || '').length
      const isLong = len >= LONG_THRESHOLD

      if (isLong) {
        // si había uno pendiente corto, que vaya solo
        if (pending) {
          out.push([pending])
          pending = null
        }
        out.push([r])
        continue
      }

      // corto/normal
      if (!pending) {
        pending = r
      } else {
        out.push([pending, r])
        pending = null
      }
    }

    if (pending) out.push([pending])
    return out
  }, [reviewsSorted])

  return (
    <section className="max-w-6xl mx-auto px-4 py-10 text-gray-900">
      {/* Header + botón */}
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

        {/* Botão “Avaliar no Google” ao lado do título */}
        <a
          href="https://www.google.com/maps/place/Ziza+Tours/@-22.0582336,-44.2428833,8z/data=!3m1!4b1!4m6!3m5!1s0x948854da284acb3:0x8137f5f1960b463!8m2!3d-22.0660686!4d-42.9236307!16s%2Fg%2F11ysbwn3vr"
          target="_blank"
          rel="noreferrer"
          className="shrink-0 inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-900 hover:bg-black/5"
        >
          Avaliar no Google
        </a>
      </div>

      {/* MOBILE: carrusel */}
      <div className="md:hidden -mx-4 px-4 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3">
        {reviewsSorted.map((r, i) => (
          <div key={i} className="snap-start min-w-[85%]">
            <ReviewCard r={r} />
          </div>
        ))}
      </div>

      {/* DESKTOP: columnas horizontales (2 por columna; largos van solos) */}
      <div className="hidden md:block">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max snap-x snap-mandatory">
            {columns.map((col, i) => (
              <div
                key={i}
                className="snap-start w-[420px] lg:w-[460px] flex flex-col gap-6"
              >
                {col.map((r, j) => (
                  <ReviewCard key={`${i}-${j}-${r.author}`} r={r} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* hint sutil */}
        <p className="text-xs text-gray-500 mt-1">
          Deslize para o lado para ver mais comentários →
        </p>
      </div>
    </section>
  )
}
