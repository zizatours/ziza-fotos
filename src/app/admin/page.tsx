'use client'

import { useState, useEffect } from 'react'
import ThemeToggle from '@/components/ThemeToggle'
import ResendOrderEmail from '@/components/admin/ResendOrderEmail'

// ===== helper: sanear nombres de archivo =====
const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')

// ===== helper: normalizar fecha a ISO (YYYY-MM-DD) =====
const normalizeEventDateToISO = (raw: string) => {
  const s = (raw || '').trim()

  // Ya viene en ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Formato esperado: DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null

  const dd = m[1].padStart(2, '0')
  const mm = m[2].padStart(2, '0')
  const yyyy = m[3]

  // validación básica de rangos
  const day = Number(dd)
  const month = Number(mm)
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  const iso = `${yyyy}-${mm}-${dd}`

  // validación real de fecha (evita 31/02, etc.)
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null

  const check =
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  if (check !== iso) return null

  return iso
}

const cardClass =
  "rounded-3xl border p-6 shadow-sm " +
  "bg-white border-gray-200 " +
  "dark:bg-zinc-900 dark:border-zinc-700"

const inputClass =
  "w-full rounded-lg px-3 py-2 border " +
  "bg-white text-black border-gray-300 placeholder:text-gray-500 " +
  "dark:bg-zinc-950 dark:text-white dark:border-zinc-700 dark:placeholder:text-zinc-400"

const primaryBtnClass =
  "w-full py-3 rounded-full border shadow-sm transition " +
  "bg-black text-white border-black hover:opacity-90 " +
  "dark:bg-black dark:text-white dark:border-zinc-700"

const subtleText =
  "text-sm text-gray-600 dark:text-zinc-600"

export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)

  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState('')
  const [eventImage, setEventImage] = useState<File | null>(null)
  const [imageToUpload, setImageToUpload] = useState<File | null>(null)

  const [eventTitle, setEventTitle] = useState('')
  const [events, setEvents] = useState<
    { id: string; name: string; slug: string }[]
  >([])
  const [selectedEventSlug, setSelectedEventSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [eventLocation, setEventLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [activeTab, setActiveTab] = useState<'imagen' | 'fotos' | 'index' | 'peligro'>('fotos')
  const [showCreate, setShowCreate] = useState(false)
  // ===== progreso subida =====
const [uploading, setUploading] = useState(false)
const [uploadTotal, setUploadTotal] = useState(0)
const [uploadDone, setUploadDone] = useState(0)
const [uploadCurrent, setUploadCurrent] = useState('')
const [uploadUploaded, setUploadUploaded] = useState(0)
const [uploadDuplicated, setUploadDuplicated] = useState(0)
const [uploadErrors, setUploadErrors] = useState(0)
const [uploadErrorFiles, setUploadErrorFiles] = useState<string[]>([])

// ===== progreso indexación =====
const [indexing, setIndexing] = useState(false)
const [indexTotal, setIndexTotal] = useState(0)
const [indexDone, setIndexDone] = useState(0)
const [indexCurrent, setIndexCurrent] = useState('')
const [indexIndexed, setIndexIndexed] = useState(0)
const [indexSkipped, setIndexSkipped] = useState(0)
const [indexFailed, setIndexFailed] = useState(0)
const [indexFailedFiles, setIndexFailedFiles] = useState<string[]>([])

  // ===== cargar eventos =====
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/admin/list-events', {
          cache: 'no-store',
        })
        const data = await res.json()
        const list = Array.isArray(data) ? data : data.events ?? []

        setEvents(list)

        if (list.length > 0 && !selectedEventSlug) {
          setSelectedEventSlug(list[0].slug)
        }
      } catch (e) {
        console.error(e)
      }
    }

    loadEvents()
  }, [])

  // ===== login =====
  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await res.json()

    if (data.ok) setAuthed(true)
    else alert('Clave incorrecta')
  }

  // ===== subir fotos (con progreso) =====
  const uploadFiles = async () => {
    if (!selectedEventSlug) {
      alert('Selecciona un evento primero')
      return
    }

    if (!files || files.length === 0) return
    if (uploading) return

    const list = Array.from(files)
    let uploaded = 0
    let duplicated = 0
    let errors = 0
    const errorFiles: string[] = []

    // reset UI progreso
    setUploading(true)
    setUploadTotal(list.length)
    setUploadDone(0)
    setUploadCurrent('')
    setUploadUploaded(0)
    setUploadDuplicated(0)
    setUploadErrors(0)
    setUploadErrorFiles([])

    setStatus('Subiendo fotos...')

    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      const safeName = sanitizeFileName(file.name)
      setUploadCurrent(safeName)

      const formData = new FormData()
      const safeFile = new File([file], safeName, { type: file.type })

      formData.append('file', safeFile)
      formData.append('event_slug', selectedEventSlug)

      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        })

        // (tu API responde JSON, lo dejamos igual)
        await res.json().catch(() => null)

        if (res.ok) {
          uploaded++
          setUploadUploaded(uploaded)
        } else if (res.status === 409) {
          duplicated++
          setUploadDuplicated(duplicated)
        } else {
          errors++
          errorFiles.push(file.name)
          setUploadErrors(errors)
          setUploadErrorFiles([...errorFiles])
        }
      } catch {
        errors++
        errorFiles.push(file.name)
        setUploadErrors(errors)
        setUploadErrorFiles([...errorFiles])
      }

      setUploadDone(i + 1)
    }

    const total = uploaded + duplicated + errors
    let message = `Subida completa ✅\n${uploaded} nuevas · ${duplicated} duplicadas · ${total} total`

    if (errors > 0) {
      message += `\n⚠️ Error en: ${errorFiles.join(', ')}`
    }

    setStatus(message)
    setUploading(false)
    setUploadCurrent('')
  }

  // ===== indexar fotos (con progreso) =====
  const runIndex = async () => {
    if (!selectedEventSlug) return
    if (indexing) return

    setIndexing(true)
    setStatus('Indexando fotos...')

    // reset UI progreso
    setIndexTotal(0)
    setIndexDone(0)
    setIndexCurrent('')
    setIndexIndexed(0)
    setIndexSkipped(0)
    setIndexFailed(0)
    setIndexFailedFiles([])

    const res = await fetch('/api/admin/index-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_slug: selectedEventSlug }),
    })

    if (!res.ok || !res.body) {
      setStatus('Error indexando fotos (no stream)')
      setIndexing(false)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let totalLocal = 0

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        let msg: any
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }

        if (msg.type === 'start') {
          const total = msg.total ?? msg.totalFiles ?? 0
          totalLocal = total

          setIndexTotal(total)
          setIndexDone(0)
          setIndexIndexed(0)
          setIndexSkipped(0)
          setIndexFailed(0)

          setStatus(`Archivos indexados 0/${total}`)
        }

        if (msg.type === 'file') {
          setIndexCurrent(msg.name ?? msg.file ?? '')
        }

        if (msg.type === 'failed') {
          const name = msg.name ?? ''
          if (name) setIndexFailedFiles((prev) => [...prev, name])
        }

        if (msg.type === 'progress') {
          // soporta ambos formatos:
          // - viejo: done / skipped / failed / name
          // - nuevo: done / filesOk / filesSkipped / filesFailed / file / totalFiles
          const done = msg.done ?? 0
          const skipped = msg.skipped ?? msg.filesSkipped ?? 0
          const failed = msg.failed ?? msg.filesFailed ?? 0

          const total = msg.total ?? msg.totalFiles ?? totalLocal
          if (typeof total === 'number') totalLocal = total

          const okFiles = msg.filesOk ?? Math.max(0, done - skipped - failed)

          // si viene el nombre dentro de progress (formato nuevo), lo mostramos
          if (msg.name || msg.file) setIndexCurrent(msg.name ?? msg.file ?? '')

          setIndexTotal(totalLocal)
          setIndexDone(done)
          setIndexSkipped(skipped)
          setIndexFailed(failed)
          setIndexIndexed(okFiles)

          setStatus(`Archivos indexados ${done}/${totalLocal}`)
        }

        if (msg.type === 'done') {
          setIndexCurrent('')

          const total = msg.total ?? msg.totalFiles ?? totalLocal ?? 0
          totalLocal = total

          const skipped = msg.skipped ?? msg.filesSkipped ?? 0
          const failed = msg.failed ?? msg.filesFailed ?? 0
          const okFiles = msg.ok ?? msg.filesOk ?? Math.max(0, total - skipped - failed)

          setIndexTotal(total)
          setIndexDone(total)
          setIndexSkipped(skipped)
          setIndexFailed(failed)
          setIndexIndexed(okFiles)

          setStatus(
            failed > 0
              ? `Terminó con errores ⚠️ Archivos ${total}/${total} (ok:${okFiles} skip:${skipped} fail:${failed})`
              : `Indexación lista ✅ Archivos ${total}/${total} (ok:${okFiles} skip:${skipped})`
          )
        }
      }
    }
    setIndexing(false)
  }

// ===== UI =====
return (
  <div
    id="admin-root"
    className="min-h-screen w-full px-4 bg-white text-black dark:bg-zinc-950 dark:text-white
              [color-scheme:light] dark:[color-scheme:dark]"
  >
    {/* ✅ Toggle SIEMPRE visible (login + admin) */}
    <div className="fixed top-20 right-4 z-50">
      <ThemeToggle />
    </div>

    {!authed ? (
      // ===== LOGIN =====
      <div className="min-h-screen w-full flex items-start justify-center pt-28">
        <div className="w-full max-w-sm p-6 rounded-2xl border shadow-sm
                        bg-white text-black border-gray-200
                        dark:bg-zinc-950 dark:text-white dark:border-zinc-800">
          <h1 className="text-lg font-semibold mb-4">Admin</h1>

          <input
            type="password"
            placeholder="Clave admin"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg px-3 py-2 mb-4 border
                      bg-white text-black border-gray-300 placeholder:text-gray-500
                      dark:bg-zinc-900 dark:text-white dark:border-zinc-700 dark:placeholder:text-zinc-400"
          />

          <button
            onClick={login}
            className="w-full py-2 rounded-lg
                      bg-black text-white
                      dark:bg-white dark:text-black"
          >
            Entrar
          </button>
        </div>
      </div>
    ) : (
      // ===== ADMIN =====
      <div className="w-full max-w-xl mx-auto pt-28 pb-16">
        <div className={cardClass}>
          {/* ===== Crear evento (colapsable) ===== */}
          <div className="mb-6 border-b pb-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-lg font-semibold text-black dark:text-white">
              Crear evento
            </h2>
            <span className={subtleText}>
              {showCreate ? 'Ocultar' : 'Mostrar'}
            </span>
          </button>

          {showCreate && (
            <div className="mt-4">
              <input
                type="text"
                placeholder="Nombre del evento"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className={`${inputClass} mb-3`}

              />

              <input
                type="text"
                placeholder="Ubicación del evento (ej: Maracanã, Rio de Janeiro)"
                value={eventLocation}
                onChange={(e) => setEventLocation(e.target.value)}
                className={`${inputClass} mb-3`}

              />

              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={`${inputClass} mb-3 dark:[color-scheme:light] dark:bg-white dark:text-black dark:border-gray-300`}
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setEventImage(e.target.files[0])
                }}
                className="w-full mb-3 text-sm text-gray-700
                          file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white
                          file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-900
                          hover:file:bg-gray-50
                          dark:text-zinc-200
                          dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-white
                          dark:hover:file:bg-zinc-800"
              />

              <button
                onClick={async () => {
                  if (!eventTitle || !eventDate) return

                  setStatus('Creando evento...')

                  const formData = new FormData()
                  formData.append('title', eventTitle)
                  formData.append('location', eventLocation)

                  const eventDateISO = normalizeEventDateToISO(eventDate)
                  if (!eventDateISO) {
                    setStatus('Fecha inválida. Usa DD/MM/YYYY (ej: 20/10/2025) o YYYY-MM-DD.')
                    return
                  }
                  formData.append('event_date', eventDateISO)

                  if (eventImage) formData.append('image', eventImage)

                  const res = await fetch('/api/admin/create-event', {
                    method: 'POST',
                    body: formData,
                  })

                  const data = await res.json()

                  if (res.ok) {
                    setStatus(`Evento creado ✅ (${data.slug})`)
                    setEventTitle('')
                    setShowCreate(false)
                    window.location.reload()
                  } else {
                    setStatus(data.error || 'Error creando evento')
                  }
                }}
                className={primaryBtnClass}
              >
                Crear evento
              </button>
            </div>
          )}
        </div>

        {/* ===== Selector de evento ===== */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-800 dark:text-zinc-200">
            Evento seleccionado
          </label>

          <select
            className={`${inputClass} dark:[&>option]:bg-zinc-900 dark:[&>option]:text-white`}
            value={selectedEventSlug}
            onChange={(e) => {
              setSelectedEventSlug(e.target.value)
              setActiveTab('fotos')
            }}
          >

            <option value="">Selecciona un evento</option>

            {events.map((event) => (
              <option key={event.id} value={event.slug}>
                {event.name}
              </option>
            ))}
          </select>

          {activeTab === 'imagen' && (
            <div className="mt-4 border p-4 rounded-lg dark:border-zinc-800">
              <p className="font-medium mb-2">
                Cambiar imagen principal del evento
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) setImageToUpload(e.target.files[0])
                }}
                className="mb-3 w-full text-sm text-gray-700
                          file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white
                          file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-900
                          hover:file:bg-gray-50
                          dark:text-zinc-200
                          dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-white
                          dark:hover:file:bg-zinc-800"
              />

              <button
                onClick={async () => {
                  if (!imageToUpload || !selectedEventSlug) return

                  const formData = new FormData()
                  formData.append('eventSlug', selectedEventSlug)
                  formData.append('image', imageToUpload)

                  await fetch('/api/admin/update-event-image', {
                    method: 'POST',
                    body: formData,
                  })

                  window.location.reload()
                }}
                className="px-4 py-2 rounded
                          bg-black text-white
                          dark:bg-white dark:text-black"
              >
                Guardar imagen
              </button>
            </div>
          )}
        </div>

        {/* ===== Tabs ===== */}
        <div className="flex gap-2 mt-6">
          <button
            className={`flex-1 border py-2 rounded ${
              activeTab === 'imagen'
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
            onClick={() => setActiveTab('imagen')}
          >
            Imagen
          </button>

          <button
            className={`flex-1 border py-2 rounded ${
              activeTab === 'fotos'
                ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
            onClick={() => setActiveTab('fotos')}
          >
            Fotos
          </button>

          <button
            className={`flex-1 border py-2 rounded ${
              activeTab === 'index'
                ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 dark:bg-zinc-900 dark:text-zinc-200 dark:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
            onClick={() => setActiveTab('index')}
          >
            Indexación
          </button>

          <button
            className={`flex-1 border py-2 rounded ${
              activeTab === 'peligro'
                ? 'bg-red-600 text-white border-red-600'
                : 'border-red-300 text-red-600 dark:border-red-500'
            }`}
            onClick={() => setActiveTab('peligro')}
          >
            Peligro
          </button>
        </div>

        {/* ===== Subir fotos ===== */}
        {activeTab === 'fotos' && (
          <>
            <h1 className="text-xl font-semibold mb-4 mt-6 text-black dark:text-white">
              Subir fotos del evento
            </h1>

            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(e.target.files ?? null)}
              className="block w-full text-sm text-gray-700
                        file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white
                        file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-900
                        hover:file:bg-gray-50
                        dark:text-zinc-200
                        dark:file:border-zinc-700 dark:file:bg-zinc-900 dark:file:text-white
                        dark:hover:file:bg-zinc-800"
            />

            <button
              onClick={uploadFiles}
              disabled={uploading || !selectedEventSlug || !files || files.length === 0}
              className={`${primaryBtnClass} mt-4 ${
                uploading || !selectedEventSlug || !files || files.length === 0
                  ? 'opacity-60 cursor-not-allowed'
                  : ''
              }`}
            >
              {uploading ? `Subiendo ${uploadDone}/${uploadTotal}…` : 'Subir fotos'}
            </button>
            {uploading && (
              <div className="mt-4">
                <div className="text-sm text-gray-700 dark:text-zinc-300">
                  Archivo: <span className="font-medium">{uploadCurrent}</span>
                </div>

                <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded mt-2 overflow-hidden">
                  <div
                    className="h-2 bg-black dark:bg-white"
                    style={{
                      width:
                        uploadTotal > 0
                          ? `${Math.round((uploadDone / uploadTotal) * 100)}%`
                          : '0%',
                    }}
                  />
                </div>

                <div className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
                  {uploadUploaded} nuevas · {uploadDuplicated} duplicadas · {uploadErrors} errores
                </div>

                {uploadErrors > 0 && uploadErrorFiles.length > 0 && (
                  <div className="text-xs text-red-600 mt-2 break-words">
                    Fallaron: {uploadErrorFiles.join(', ')}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ===== Indexar fotos ===== */}
        {activeTab === 'index' && (
          <div className="mt-6">
            <button
              onClick={runIndex}
              disabled={indexing || !selectedEventSlug}
              className={`w-full py-3 rounded-full border dark:border-zinc-700 ${
                indexing ? 'opacity-50' : ''
              }`}
            >
              {indexing ? `Indexando ${indexDone}/${indexTotal || '…'}…` : 'Indexar fotos'}
            </button>

            {indexing && (
              <div className="mt-4">
                <div className="text-sm text-gray-700 dark:text-zinc-300">
                  Archivo: <span className="font-medium">{indexCurrent || '—'}</span>
                </div>

                <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded mt-2 overflow-hidden">
                  <div
                    className="h-2 bg-black dark:bg-white"
                    style={{
                      width:
                        indexTotal > 0
                          ? `${Math.round((indexDone / indexTotal) * 100)}%`
                          : '0%',
                    }}
                  />
                </div>

                <div className="text-xs text-gray-600 dark:text-zinc-400 mt-2">
                  {indexIndexed} ok · {indexSkipped} saltadas · {indexFailed} fallidas
                </div>

                {indexFailedFiles.length > 0 && (
                  <div className="text-xs text-red-600 mt-2 break-words">
                    Fallaron: {indexFailedFiles.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== Eliminar evento ===== */}
        {activeTab === 'peligro' && (
          <div className="mt-6 space-y-4">
            <ResendOrderEmail adminKey={password} />

            <button
              onClick={async () => {
                if (!selectedEventSlug) return

                const confirmDelete = confirm(
                  '⚠️ Esto eliminará el evento, sus fotos y sus caras. ¿Continuar?'
                )
                if (!confirmDelete) return

                setStatus('Eliminando evento.')

                const res = await fetch('/api/admin/delete-event', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ event_slug: selectedEventSlug }),
                })

                const data = await res.json()

                if (res.ok) {
                  setStatus('Evento eliminado correctamente ✅')
                  window.location.reload()
                } else {
                  setStatus(data.error || 'Error eliminando evento')
                }
              }}
              className="w-full border border-red-500 text-red-600 py-3 rounded-full"
            >
              Eliminar evento
            </button>
          </div>
        )}

        {status && (
          <p className="text-sm text-gray-600 dark:text-zinc-400 mt-6 whitespace-pre-line">
            {status}
          </p>
        )}
      </div>
    </div>
    )}
  </div>
)}
