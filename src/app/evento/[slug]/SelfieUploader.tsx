'use client'

import { useState, useRef } from 'react'

const fakePhotos = [
  'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
]

export default function SelfieUploader({
  eventSlug,
}: {
  eventSlug: string
}) {

  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<File | null>(null)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(false)
  const [adminFileName, setAdminFileName] = useState<string | null>(null)
  const adminFileRef = useRef<File | null>(null)
  const [adminStatus, setAdminStatus] = useState<string>('')
  const [matches, setMatches] = useState<any[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [statusText, setStatusText] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const toggleSelect = (url: string) => {
    setSelected(prev =>
      prev.includes(url)
        ? prev.filter(u => u !== url)
        : [...prev, url]
    )
  }

  const togglePhoto = (url: string) => {
    setSelected(prev =>
      prev.includes(url)
        ? prev.filter(p => p !== url)
        : [...prev, url]
    )
  }

  return (
    <div className="border rounded-2xl p-8 shadow-sm text-center">
      {!results && (
        <>
          <h2 className="text-xl font-medium mb-2">
            Sube tu selfie
          </h2>

          <p className="text-gray-600 text-sm mb-6">
            Sube una selfie y te mostraremos solo las fotos donde apareces
          </p>

          {!searching && !searched && (
            <p className="text-center text-gray-500 text-sm mb-4">
              Sube una selfie para buscar tus fotos 📸
            </p>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="h-8 w-8 mb-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
              <p className="text-center text-gray-600 text-sm">
                {statusText ?? 'Buscando tus fotos…'}
              </p>
            </div>
          )}

          {!searching && (
            <label className="block w-full border rounded-full py-3 text-gray-700 cursor-pointer mb-4">
              Seleccionar selfie
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
          )}

          {fileName && !searching && (
            <button
              onClick={async () => {
                if (!fileRef.current) return

                setSearching(true)
                setStatusText('Analizando tu selfie…')
                setErrorMsg(null)
                setMatches([])
                setSelected([])
                setSearched(false)

                const formData = new FormData()
                formData.append('file', fileRef.current)

                try {
                  setStatusText('Analizando tu selfie…')

                  formData.append('event_slug', eventSlug)

                  const res = await fetch('/api/event/search', {
                    method: 'POST',
                    body: formData,
                  })

                  setStatusText('Comparando con las fotos del evento…')

                  const data = await res.json()

                  const grouped = Object.values(
                    (data.matches || []).reduce((acc: any, match: any) => {
                      if (!acc[match.image_url]) {
                        acc[match.image_url] = {
                          image_url: match.image_url,
                          bestSimilarity: match.similarity,
                        }
                      } else {
                        acc[match.image_url].bestSimilarity = Math.max(
                          acc[match.image_url].bestSimilarity,
                          match.similarity
                        )
                      }
                      return acc
                    }, {})
                  )

                  setMatches(grouped)
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

        </>
      )}

      {results && (
        <>
          <h2 className="text-xl font-medium mb-4">
            Resultados
          </h2>

          {searching && matches.length === 0 && (
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-40 rounded-lg bg-gray-200 animate-pulse"
                />
              ))}
            </div>
          )}

          {errorMsg && (
            <p className="text-red-500 text-sm mb-4">
              {errorMsg}
            </p>
          )}

          {searched && !searching && matches.length === 0 && !errorMsg && (
            <div className="text-gray-600 text-sm">
              <p className="mb-2">
                No encontramos fotos donde aparezcas 😢
              </p>
              <p className="text-xs">
                Puede que las fotos del evento aún se estén procesando
                o que no aparezcas en ellas.
              </p>
            </div>
          )}

          <p className="text-center text-gray-600 text-sm mb-4">
            Encontramos {matches.length} foto
            {matches.length > 1 ? 's' : ''} donde apareces 🎉
          </p>

          {matches.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {matches.map((m, i) => (
                  <div
                    key={i}
                    className={`relative border rounded-lg overflow-hidden shadow-sm ${
                      selected.includes(m.image_url)
                        ? 'ring-4 ring-black'
                        : ''
                    }`}
                  >
                    {/* Imagen real */}
                    <img
                      src={m.image_url}
                      alt="Foto del evento"
                      className="w-full h-40 object-cover cursor-pointer"
                      onClick={() => toggleSelect(m.image_url)}
                    />

                    {/* Marca de agua repetida (solo visual) */}
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-4 opacity-35">
                        {Array.from({ length: 12 }).map((_, idx) => (
                          <div key={idx} className="flex items-center justify-center">
                            <span className="text-white text-xs font-semibold rotate-[-30deg] select-none drop-shadow-sm">
                              ZIZA FOTOS
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 my-4">
                {selected.length} fotos seleccionadas
              </p>

              <button
                disabled={selected.length === 0}
                onClick={async () => {
                  if (!selected.length) return

                  for (const url of selected) {
                    try {
                      const res = await fetch(url)
                      const blob = await res.blob()

                      const blobUrl = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = blobUrl
                      a.download = 'imagen-evento.jpg'
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)

                      URL.revokeObjectURL(blobUrl)
                    } catch (e) {
                      alert('Error descargando una de las fotos')
                    }
                  }
                }}
                className="w-full bg-black text-white rounded-full py-3 disabled:opacity-40"
              >
                Descargar selección
              </button>
            </>
          )}
        </>
      )}
      <p className="text-xs text-gray-400 mt-6">
        Tu selfie se usa solo para encontrar tus fotos.
        No se publica ni se guarda.
      </p>
    </div>
  )
}