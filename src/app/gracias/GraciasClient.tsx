'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type Order = {
  id: string
  created_at: string
  event_slug: string | null
  email: string
  images?: string[]
  selected_images?: string[]
  total: number
  currency: string
  status: string
}

export default function GraciasClient() {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloadUrls, setDownloadUrls] = useState<string[]>([])
  const [downloading, setDownloading] = useState(false)

  const searchParams = useSearchParams()
  const orderId = searchParams.get('order') || ''

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const bucket = 'event-photos'

  const toPublicUrl = (pathOrUrl: string) => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!supabaseUrl) return pathOrUrl
    const clean = pathOrUrl.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`
  }

  const getPreviewUrl = (pathOrUrl: string) => {
    const publicUrl = toPublicUrl(pathOrUrl)
    return `/api/preview?src=${encodeURIComponent(publicUrl)}`
  }

  useEffect(() => {
    if (!orderId) {
      setError('Falta el parámetro order.')
      return
    }

    ;(async () => {
      const res = await fetch(`/api/orders/get?order=${encodeURIComponent(orderId)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || 'No se pudo cargar la orden.')
        return
      }

      setOrder(data.order)
    })()
  }, [orderId])

  if (error) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">Ups</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <a href="/" className="inline-block bg-black text-white rounded-full px-6 py-3 text-sm">
            Volver al inicio
          </a>
        </div>
      </main>
    )
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-6 py-16 text-center">
          <p className="text-gray-600">Cargando tu compra…</p>
        </div>
      </main>
    )
  }

  const pics = (order.selected_images || order.images || []).filter(Boolean)

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">¡Pago confirmado!</h1>
        <p className="text-gray-600 mb-6">
          Orden: <span className="font-mono text-sm">{order.id}</span>
        </p>

        <div className="mb-6">
          <button
            onClick={async () => {
              setDownloading(true)
              const res = await fetch(
                `/api/orders/download-links?order=${encodeURIComponent(order.id)}`
              )
              const data = await res.json().catch(() => ({} as any))
              setDownloading(false)

              if (!res.ok) {
                alert(`No se pudieron generar links: ${data?.error || 'desconocido'}`)
                return
              }

              setDownloadUrls(data.urls || [])
            }}
            className="bg-black text-white rounded-full px-6 py-3 text-sm disabled:opacity-50"
            disabled={downloading}
          >
            {downloading ? 'Generando links…' : 'Descargar fotos'}
            <a
              href={`/api/orders/download-zip?order=${encodeURIComponent(order.id)}`}
              className="inline-block bg-black text-white rounded-full px-6 py-3 text-sm ml-3"
            >
              Descargar todo (ZIP)
            </a>
          </button>

          {!!downloadUrls.length && (
            <div className="mt-4 space-y-2">
              {downloadUrls.map((u, i) => (
                <a
                  key={i}
                  href={u}
                  className="block text-sm underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar foto {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-10">
          {pics.slice(0, 30).map((p, i) => (
            <a key={i} href={toPublicUrl(p)} target="_blank" rel="noreferrer">
              <img
                src={getPreviewUrl(p)}
                className="aspect-square object-cover rounded-lg"
                alt="Foto"
              />
            </a>
          ))}
        </div>

        <a href="/" className="inline-block bg-black text-white rounded-full px-6 py-3 text-sm">
          Volver al inicio
        </a>
      </div>
    </main>
  )
}
