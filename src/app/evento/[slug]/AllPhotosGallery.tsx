'use client'

import { useEffect, useState } from 'react'

type Item = {
  originalPath: string
  thumbPath: string | null
}

export default function AllPhotosGallery({
  eventSlug,
  selected,
  setSelected,
  onCheckout,
}: {
  eventSlug: string
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  onCheckout: () => void
}) {
  // ✅ Hook SIEMPRE dentro del componente
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [error, setError] = useState<string | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const THUMB_BUCKET = 'event-previews'

  const toPublicUrl = (bucket: string, pathOrUrl: string) => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!supabaseUrl) return pathOrUrl
    const clean = pathOrUrl.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`
  }

  const toWatermarkedPreview = (path: string) =>
    `/api/preview?path=${encodeURIComponent(path)}&w=520&q=60&fmt=webp`

  const toggle = (originalPath: string) => {
    setSelected((prev) =>
      prev.includes(originalPath) ? prev.filter((p) => p !== originalPath) : [...prev, originalPath]
    )
  }

  const loadMore = async () => {
    if (loading) return
    if (nextOffset === null) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/event/list-photos?event_slug=${encodeURIComponent(eventSlug)}&limit=24&offset=${nextOffset}`,
        { cache: 'no-store' }
      )
      const json = await res.json().catch(() => null)

      if (!res.ok) throw new Error(json?.error || 'list_failed')

      const newItems = Array.isArray(json?.items) ? (json.items as Item[]) : []
      setItems((prev) => [...prev, ...newItems])
      setNextOffset(typeof json?.nextOffset === 'number' ? json.nextOffset : null)
    } catch {
      setError('Não foi possível carregar as fotos do evento.')
      setNextOffset(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // carga inicial al cambiar evento
    setItems([])
    setNextOffset(0)
    setBrokenThumbs({})
  }, [eventSlug])

  useEffect(() => {
    if (nextOffset === 0 && items.length === 0) loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextOffset])

  const hasMore = nextOffset !== null
  const selectedCount = selected.length

  return (
    <section className="mt-12 text-left">
      <div className="max-w-6xl mx-auto px-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Todas as fotos do evento</h3>
        <p className="text-sm text-gray-600 mb-6">
          Você também pode selecionar fotos aqui (além das que aparecem pela selfie).
        </p>

        {error && <div className="text-sm text-red-600 mb-4">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((it) => {
            const key = it.originalPath
            const isSelected = selected.includes(it.originalPath)

            const thumbSrc = it.thumbPath ? toPublicUrl(THUMB_BUCKET, it.thumbPath) : ''
            const fallbackSrc = toWatermarkedPreview(it.originalPath)

            const src = brokenThumbs[key] ? fallbackSrc : thumbSrc || fallbackSrc

            return (
              <div
                key={key}
                className={`relative border rounded-lg overflow-hidden shadow-sm ${
                  isSelected ? 'ring-4 ring-black' : ''
                }`}
              >
                <img
                  src={src}
                  alt="Foto del evento"
                  className="w-full h-40 object-cover cursor-pointer"
                  onClick={() => toggle(it.originalPath)}
                  loading="lazy"
                  onError={() => {
                    // si el thumb falla, caemos a /api/preview una sola vez
                    setBrokenThumbs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
                  }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="text-sm text-gray-700">
            <span translate="no" className="notranslate font-medium">
              {selectedCount}
            </span>{' '}
            fotos selecionadas
          </div>

          <div className="flex gap-3">
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loading}
                className="rounded-full border px-5 py-3 text-sm text-gray-900 disabled:opacity-50"
              >
                {loading ? 'Carregando…' : 'Mostrar mais'}
              </button>
            )}

            <button
              type="button"
              onClick={onCheckout}
              disabled={selectedCount === 0}
              className="rounded-full bg-black text-white px-6 py-3 text-sm disabled:opacity-40"
            >
              Ir para o checkout
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
