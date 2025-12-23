'use client'

import { useState, useRef } from 'react'

const fakePhotos = [
  'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee',
]

export default function SelfieUploader() {
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
            Usamos reconocimiento facial para mostrarte solo tus fotos
          </p>

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

                const formData = new FormData()
                formData.append('file', fileRef.current)

                try {
                  setStatusText('Analizando tu selfie…')

                  const res = await fetch('/api/face/compare', {
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

          {searching && (
            <div className="text-gray-600 text-sm animate-pulse">
              🔍 {statusText ?? 'Buscando tus fotos…'}
            </div>
          )}

        </>
      )}

      {results && (
        <>
          <h2 className="text-xl font-medium mb-4">
            Resultados
          </h2>

          {errorMsg && (
            <p className="text-red-500 text-sm mb-4">
              {errorMsg}
            </p>
          )}

          {!matches.length && !errorMsg && (
            <div className="text-gray-600 text-sm">
              <p className="mb-2">Aún no encontramos coincidencias.</p>
              <p className="text-xs">
                Puede que las fotos del evento todavía se estén procesando
                o que aún no estén disponibles.
              </p>
            </div>
          )}
          
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

                    {/* Marca de agua (solo visual) */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-20"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(-45deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 200px)',
                      }}
                    >
                      {/* Marca de agua repetida (solo visual) */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-25"
                        style={{
                          backgroundImage: `
                            repeating-linear-gradient(
                              -30deg,
                              rgba(255,255,255,0.4) 0,
                              rgba(255,255,255,0.4) 1px,
                              transparent 1px,
                              transparent 180px
                            )
                          `,
                        }}
                      >
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `
                              repeating-linear-gradient(
                                -30deg,
                                transparent 0,
                                transparent 120px,
                                rgba(255,255,255,0.6) 120px,
                                rgba(255,255,255,0.6) 121px,
                                transparent 121px,
                                transparent 240px
                              )
                            `,
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-white text-xl font-bold rotate-[-30deg] select-none">
                            ZIZA FOTOS
                          </span>
                        </div>
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