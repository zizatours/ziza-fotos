'use client'

import { useState, useRef } from 'react'

export default function SelfieUploader({
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
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<File | null>(null)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(false)
  const [matches, setMatches] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const THUMB_BUCKET = 'event-previews'

  const toPublicUrl = (bucket: string, pathOrUrl: string) => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!supabaseUrl) return pathOrUrl
    const clean = pathOrUrl.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`
  }

  // Convierte "eventos/<slug>/original/<file>.jpg" => "eventos/<slug>/thumb/<base>.webp"
  // (y soporta legacy "<slug>/<file>.jpg" como fallback)
  const toThumbPathFromMatch = (match: string) => {
    if (!match) return null
    if (/^https?:\/\//i.test(match)) return match // ya es URL, úsala tal cual
    const clean = match.replace(/^\/+/, '')

    // si ya viene como thumb path
    if (clean.includes('/thumb/') && clean.endsWith('.webp')) return clean

    const mNew = clean.match(/^eventos\/([^/]+)\/original\/(.+)$/)
    if (mNew) {
      const slug = mNew[1]
      const file = mNew[2]
      const base = file.replace(/\.[^.]+$/, '')
      return `eventos/${slug}/thumb/${base}.webp`
    }

    // legacy: "<slug>/<file>"
    const mOld = clean.match(/^([^/]+)\/(.+)$/)
    if (mOld) {
      const slug = mOld[1]
      const file = mOld[2]
      const base = file.replace(/\.[^.]+$/, '')
      return `eventos/${slug}/thumb/${base}.webp`
    }

    return null
  }

  const getResultImageSrc = (m: string) => {
    const thumbPathOrUrl = toThumbPathFromMatch(m)

    // 1) Si podemos, usamos el thumb público (mismo que grilla del evento)
    if (thumbPathOrUrl) {
      // si ya es URL retorna igual; si es path lo convierte a public URL de event-previews
      return toPublicUrl(THUMB_BUCKET, thumbPathOrUrl)
    }

    // 2) Último fallback: preview en vivo
    // (si m es URL => src= , si no => path=)
    const isUrl = /^https?:\/\//i.test(m)
    return isUrl
      ? `/api/preview?src=${encodeURIComponent(m)}&w=520&q=60&fmt=webp`
      : `/api/preview?path=${encodeURIComponent(m)}&w=520&q=60&fmt=webp`
  }

  const toggleSelect = (url: string) => {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]))
  }

  return (
    <div className="w-full text-center">
      {!results && (
        <div className="max-w-md mx-auto border rounded-2xl p-8 shadow-sm">
          {!searching && !searched && (
            <p className="text-center text-gray-500 text-sm mb-4">
              Sube una selfie para buscar tus fotos 📸
            </p>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="h-8 w-8 mb-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
              <p className="text-center text-gray-600 text-sm">{statusText ?? 'Buscando tus fotos…'}</p>
            </div>
          )}

          {!searching && (
            <div className="space-y-3 mb-4">
              {/* 1) Tomar foto (câmera) */}
              <label className="block w-full border rounded-full py-3 text-gray-700 cursor-pointer">
                Tirar foto (câmera)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setFileName(e.target.files[0].name)
                      fileRef.current = e.target.files[0]
                    }
                  }}
                />
              </label>

              {/* 2) Escolher da galeria */}
              <label className="block w-full border rounded-full py-3 text-gray-700 cursor-pointer">
                Escolher da galeria
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setFileName(e.target.files[0].name)
                      fileRef.current = e.target.files[0]
                    }
                  }}
                />
              </label>
            </div>
          )}

          {fileName && !searching && (
            <button
              onClick={async () => {
                if (!fileRef.current) return

                setSearching(true)
                setStatusText('Analizando tu selfie…')
                setErrorMsg(null)
                setMatches([])
                setSearched(false)

                const formData = new FormData()
                formData.append('selfie', fileRef.current)

                try {
                  formData.append('event_slug', eventSlug)

                  const res = await fetch('/api/event/search', {
                    method: 'POST',
                    body: formData,
                  })

                  const data = await res.json()
                  setStatusText('Comparando con las fotos del evento…')

                  setMatches(data.results || [])
                  setResults(true)
                  setSearched(true)
                } catch (err) {
                  setErrorMsg('Ocurrió un error al buscar tus fotos')
                } finally {
                  setSearching(false)
                  setStatusText(null)
                }
              }}
              className="w-full bg-black text-white rounded-full py-3 mb-4"
            >
              Buscar mis fotos
            </button>
          )}
        </div>
      )}

      {results && (
        <>
          <h2 className="text-xl font-medium mb-4">Resultados</h2>

          {searching && matches.length === 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 rounded-lg bg-gray-200 animate-pulse" />
              ))}
            </div>
          )}

          {errorMsg && <p className="text-red-500 text-sm mb-4">{errorMsg}</p>}

          {searched && !searching && matches.length === 0 && !errorMsg && (
            <div className="text-gray-600 text-sm">
              <p className="mb-2">No encontramos fotos donde aparezcas 😢</p>
              <p className="text-xs">
                Puede que las fotos del evento aún se estén procesando o que no aparezcas en ellas.
              </p>
            </div>
          )}

          <p className="text-center text-gray-600 text-sm mb-4">
            Encontramos {matches.length} foto{matches.length > 1 ? 's' : ''} donde apareces 🎉
          </p>

          {matches.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {matches.map((m) => (
                  <div
                    key={m}
                    className={`relative border rounded-lg overflow-hidden shadow-sm ${
                      selected.includes(m) ? 'ring-4 ring-black' : ''
                    }`}
                  >
                    <img
                      src={getResultImageSrc(m)}
                      alt="Foto del evento"
                      className="w-full h-40 object-cover cursor-pointer"
                      onClick={() => toggleSelect(m)}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 my-4">
                <span translate="no" className="notranslate">
                  {selected.length}
                </span>{' '}
                fotos seleccionadas
              </p>

              <button
                disabled={selected.length === 0}
                onClick={onCheckout}
                className="w-full bg-black text-white rounded-full py-3 disabled:opacity-40"
              >
                Continuar y pagar
              </button>
            </>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Tu selfie se usa solo para encontrar tus fotos. No se publica ni se guarda.
      </p>
    </div>
  )
}
