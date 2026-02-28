'use client'

import { useEffect, useMemo, useState } from 'react'

type EventItem = {
  id: string
  name: string
  slug: string
  event_date?: string | null
}

type PhotoItem = {
  originalPath: string
  thumbPath: string | null
}

const THUMB_BUCKET = 'event-previews'

export default function AdminDeletePhotosPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventSlug, setSelectedEventSlug] = useState('')
  const [items, setItems] = useState<PhotoItem[]>([])
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({})

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  const toPublicThumbUrl = (pathOrUrl: string) => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!supabaseUrl) return pathOrUrl
    const clean = pathOrUrl.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${THUMB_BUCKET}/${clean}`
  }

  const toPreviewFallback = (originalPath: string) =>
    `/api/preview?path=${encodeURIComponent(originalPath)}&w=520&q=60&fmt=webp`

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const eventFromQuery = (params.get('event') || '').trim()

    ;(async () => {
      try {
        const res = await fetch('/api/admin/list-events', { cache: 'no-store' })
        const data = await res.json().catch(() => ({} as any))
        const list = Array.isArray(data) ? data : data.events ?? []

        setEvents(list)

        if (eventFromQuery && list.some((e: EventItem) => e.slug === eventFromQuery)) {
          setSelectedEventSlug(eventFromQuery)
        } else if (list.length > 0) {
          setSelectedEventSlug(list[0].slug)
        }
      } catch (e) {
        console.error(e)
        setStatus('No fue posible cargar eventos.')
      }
    })()
  }, [])

  useEffect(() => {
    // reset al cambiar evento
    setItems([])
    setNextOffset(0)
    setSelectedPaths([])
    setBrokenThumbs({})
  }, [selectedEventSlug])

  useEffect(() => {
    if (!selectedEventSlug) return
    if (nextOffset !== 0) return
    if (items.length > 0) return
    void loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventSlug, nextOffset])

  const hasMore = nextOffset !== null

  const toggleSelected = (path: string) => {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    )
  }

  const selectAllVisible = () => {
    setSelectedPaths(items.map((it) => it.originalPath))
  }

  const clearSelection = () => {
    setSelectedPaths([])
  }

  async function loadMore() {
    if (!selectedEventSlug) return
    if (loading) return
    if (nextOffset === null) return

    setLoading(true)
    setStatus('')

    try {
      const res = await fetch(
        `/api/event/list-photos?event_slug=${encodeURIComponent(selectedEventSlug)}&limit=24&offset=${nextOffset}`,
        { cache: 'no-store' }
      )

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        setStatus(data?.error || 'Error cargando fotos del evento.')
        return
      }

      const newItems = Array.isArray(data?.items) ? (data.items as PhotoItem[]) : []
      setItems((prev) => [...prev, ...newItems])
      setNextOffset(typeof data?.nextOffset === 'number' ? data.nextOffset : null)
    } catch (e) {
      console.error(e)
      setStatus('Error de red cargando fotos.')
    } finally {
      setLoading(false)
    }
  }

  async function deleteSelected() {
    if (!selectedEventSlug || selectedPaths.length === 0) return
    if (deleting) return

    const totalToDelete = selectedPaths.length

    const ok = window.confirm(
      `⚠️ Se borrarán ${totalToDelete} foto(s) del storage, thumbnails e indexación facial. ¿Continuar?`
    )
    if (!ok) return

    setDeleting(true)
    setStatus(`Borrando ${totalToDelete} foto(s)...`)

    let okCount = 0
    let failCount = 0
    let facesDeleted = 0
    let indexedDeleted = 0
    const failed: string[] = []

    try {
      for (const originalPath of selectedPaths) {
        try {
          const res = await fetch('/api/admin/delete-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_slug: selectedEventSlug,
              original_path: originalPath,
            }),
          })

          const data = await res.json().catch(() => ({} as any))

          if (!res.ok) {
            failCount++
            failed.push(originalPath)
            continue
          }

          okCount++
          facesDeleted += Number(data?.deleted?.faces ?? 0)
          indexedDeleted += Number(data?.deleted?.indexed ?? 0)

          setItems((prev) => prev.filter((it) => it.originalPath !== originalPath))
          setBrokenThumbs((prev) => {
            if (!prev[originalPath]) return prev
            const next = { ...prev }
            delete next[originalPath]
            return next
          })

          setStatus(`Borrando ${okCount + failCount}/${totalToDelete}...`)
        } catch {
          failCount++
          failed.push(originalPath)
        }
      }

      setSelectedPaths([])

      let msg = `✅ Borradas ${okCount}/${totalToDelete} foto(s). Faces: ${facesDeleted} · Indexed: ${indexedDeleted}`
      if (failCount > 0) {
        msg += `\n⚠️ Fallaron ${failCount}: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''}`
      }
      setStatus(msg)
    } catch (e) {
      console.error(e)
      setStatus('❌ Error de red borrando fotos.')
    } finally {
      setDeleting(false)
    }
  }

  const selectedCount = selectedPaths.length

  return (
    <main className="min-h-screen bg-white text-black px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Borrar fotos unitariamente</h1>
            <p className="text-sm text-gray-600">
              Selecciona una foto para borrarla del original, thumbnail e indexación.
            </p>
          </div>

          <a
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-black px-4 py-2 text-sm hover:bg-gray-50"
          >
            Volver al admin
          </a>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 mb-6">
          <label className="block text-sm font-medium mb-2">Evento</label>

          <select
            value={selectedEventSlug}
            onChange={(e) => setSelectedEventSlug(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-white"
          >
            <option value="">Selecciona un evento</option>
            {events.map((event) => (
              <option key={event.id} value={event.slug}>
                {event.name}
                {event.event_date ? ` (${event.event_date})` : ''}
              </option>
            ))}
          </select>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="text-sm text-gray-700">
              {selectedCount} foto{selectedCount === 1 ? '' : 's'} seleccionada{selectedCount === 1 ? '' : 's'}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={!items.length || deleting}
                className="rounded-full border px-4 py-2 text-sm disabled:opacity-50"
              >
                Seleccionar visibles
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedCount === 0 || deleting}
                className="rounded-full border px-4 py-2 text-sm disabled:opacity-50"
              >
                Limpiar selección
              </button>

              {hasMore && (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading || !selectedEventSlug || deleting}
                  className="rounded-full border px-4 py-2 text-sm disabled:opacity-50"
                >
                  {loading ? 'Cargando…' : 'Mostrar más'}
                </button>
              )}

              <button
                type="button"
                onClick={deleteSelected}
                disabled={selectedCount === 0 || deleting}
                className="rounded-full bg-red-600 text-white px-5 py-2 text-sm disabled:opacity-50"
              >
                {deleting
                  ? `Borrando…`
                  : `Borrar ${selectedCount > 0 ? `${selectedCount} foto${selectedCount === 1 ? '' : 's'}` : 'selección'}`}
              </button>
            </div>
          </div>
        </div>

        {status && (
          <p className="text-sm mb-4 whitespace-pre-line">{status}</p>
        )}

        {!selectedEventSlug ? (
          <div className="text-sm text-gray-600">Selecciona un evento para ver sus fotos.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((it) => {
              const key = it.originalPath
              const isSelected = selectedPaths.includes(it.originalPath)

              const thumbSrc = it.thumbPath ? toPublicThumbUrl(it.thumbPath) : ''
              const fallbackSrc = toPreviewFallback(it.originalPath)
              const src = brokenThumbs[key] ? fallbackSrc : thumbSrc || fallbackSrc

              return (
                <div
                  key={key}
                  className={`relative border rounded-lg overflow-hidden shadow-sm ${
                    isSelected ? 'ring-4 ring-red-500' : ''
                  }`}
                >
                  <div className="relative">
                    <label className="absolute top-2 left-2 z-10 inline-flex items-center gap-2 bg-white/90 rounded-md px-2 py-1 border border-gray-200">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(it.originalPath)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-gray-700">Selecionar</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => toggleSelected(it.originalPath)}
                      className="w-full aspect-square bg-gray-100 flex items-center justify-center"
                      title={it.originalPath}
                    >
                      <img
                        src={src}
                        alt="Foto del evento"
                        className="max-w-full max-h-full object-contain"
                        loading="lazy"
                        onError={() => {
                          setBrokenThumbs((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
                        }}
                      />
                    </button>
                  </div>

                  <div className="px-2 py-2 border-t bg-white">
                    <p className="text-[11px] text-gray-700 break-all line-clamp-2">
                      {it.originalPath}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}