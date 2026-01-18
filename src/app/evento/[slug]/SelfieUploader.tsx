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
  const [matches, setMatches] = useState<string[]>([])
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
    <div className="w-full text-center">
      {!results && (
        <div className="max-w-md mx-auto border rounded-2xl p-8 shadow-sm">
          {!searching && !searched && (
            <p className="text-center text-gray-500 text-sm mb-4">
              Envie uma selfie para encontrar suas fotos 📸
            </p>
          )}

          {searching && (
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="h-8 w-8 mb-4 animate-spin rounded-full border-2 border-gray-300 border-t-black" />
              <p className="text-center text-gray-600 text-sm">
                {statusText ?? 'Procurando suas fotos…'}
              </p>
            </div>
          )}

          {!searching && (
            <label className="block w-full border rounded-full py-3 text-gray-700 cursor-pointer mb-4">
              Selecionar selfie
              {errorMsg && (
                <p className="text-red-500 text-sm mb-4">
                  {errorMsg}
                </p>
              )}
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
                setStatusText('Analisando sua selfie…')
                setErrorMsg(null)
                setMatches([])
                setSelected([])
                setSearched(false)

                const formData = new FormData()
                formData.append('selfie', fileRef.current)

                try {
                  setStatusText('Analisando sua selfie…')

                  formData.append('event_slug', eventSlug)

                  const res = await fetch('/api/event/search', {
                    method: 'POST',
                    body: formData,
                  })

                  if (!res.ok) {
                    setErrorMsg(`Error al buscar fotos (HTTP ${res.status}).`)
                    return
                  }

                  const data = await res.json()

                  setStatusText('Comparando com as fotos do evento…')

                  setMatches(data.results || [])

                  setResults(true)
                  setSearched(true)
                } catch (err) {
                  setErrorMsg('Ocorreu um erro ao procurar suas fotos')
                } finally {
                  setSearching(false)
                  setStatusText(null)
                }
              }}
              className="w-full bg-black text-white rounded-full py-3 mb-4"
            >
              Procurar minhas fotos
            </button>
          )}
        </div>
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
                Não encontramos fotos em que você apareça 😢
              </p>
              <p className="text-xs">
                Pode ser que as fotos do evento ainda estejam sendo processadas
                ou que você não apareça nelas.
              </p>
            </div>
          )}

          <p className="text-center text-gray-600 text-sm mb-4">
            Encontramos {matches.length} foto
            {matches.length > 1 ? 's' : ''} em que você aparece 🎉
          </p>

          {matches.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {matches.map((m, i) => (
                  <div
                    key={m}
                    className={`relative border rounded-lg overflow-hidden shadow-sm ${
                      selected.includes(m) ? 'ring-4 ring-black' : ''
                    }`}
                  >
                    <img
                      src={`/api/preview?path=${encodeURIComponent(m)}`}
                      alt="Foto do evento"
                      className="w-full h-40 object-cover cursor-pointer"
                      onClick={() => toggleSelect(m)}
                    />
                  </div>
                ))}
              </div>

              <p className="text-sm text-gray-600 my-4">
                {selected.length} fotos selecionadas
              </p>

              <button
                disabled={selected.length === 0}
                onClick={() => {
                  const payload = {
                    event_slug: eventSlug,
                    images: selected,
                  }

                  try {
                    localStorage.removeItem('ziza_checkout_selection')
                    localStorage.setItem('ziza_checkout_selection', JSON.stringify(payload))
                  } catch (err) {
                    alert(
                      'Não foi possível salvar sua seleção (o navegador pode estar bloqueando armazenamento). Tente em uma janela anônima ou desative bloqueadores.'
                    )
                    return
                  }

                  window.location.href = '/checkout'
                }}
                className="w-full bg-black text-white rounded-full py-3 disabled:opacity-40"
              >
                Continuar e pagar
              </button>
            </>
          )}
        </>
      )}
      <p className="text-xs text-gray-400 mt-6">
        Sua selfie é usada apenas para encontrar suas fotos.
        Ela não é publicada nem armazenada.
      </p>
    </div>
  )
}