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
  const [selected, setSelected] = useState<string[]>([])
  const [adminFileName, setAdminFileName] = useState<string | null>(null)
  const adminFileRef = useRef<File | null>(null)
  const [adminStatus, setAdminStatus] = useState<string>('')
  const [matches, setMatches] = useState<any[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [statusText, setStatusText] = useState<string | null>(null)

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
            <ul className="text-left text-sm">
              {matches.map((m, i) => (
                <div key={i} className="mb-4">
                  <p className="text-sm">
                    Foto encontrada — similitud {Math.round(m.bestSimilarity)}%
                  </p>
                </div>
              ))}
            </ul>
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