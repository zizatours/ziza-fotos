'use client'

import { useState, useEffect } from 'react'

const sanitizeFileName = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // reemplaza raros


export default function AdminPage() {
  const [password, setPassword] = useState('')
  const [authed, setAuthed] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [events, setEvents] = useState<
    { id: string; name: string; slug: string }[]
  >([])

  const [selectedEventSlug, setSelectedEventSlug] = useState('')

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/admin/list-events', {
          cache: 'no-store',
        })
        const data = await res.json()

        const list = Array.isArray(data)
          ? data
          : data.events ?? []

        setEvents(list)

        if (list.length > 0 && !selectedEventSlug) {
          setSelectedEventSlug(list[0].slug)
        }
      } catch (err) {
        console.error('Error cargando eventos', err)
      }
    }

    loadEvents()
  }, [])

  const login = async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await res.json()

    if (data.ok) {
      setAuthed(true)
    } else {
      alert('Clave incorrecta')
    }
  }

  const uploadFiles = async () => {
    if (!selectedEventSlug) {
      alert('Selecciona un evento primero')
      return
    }

    if (!files || files.length === 0) return

    let uploaded = 0
    let duplicated = 0
    let errors = 0
    const errorFiles: string[] = []

    setStatus('Subiendo fotos...')

    for (const file of Array.from(files)) {
      const formData = new FormData()
      const safeFile = new File([file], sanitizeFileName(file.name), {
        type: file.type,
      })

      formData.append('file', safeFile)
      formData.append('event_slug', selectedEventSlug)

      try {
        const res = await fetch('/api/admin/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (res.ok) {
          uploaded++
        } else if (res.status === 409) {
          duplicated++
        } else {
          errors++
          errorFiles.push(file.name)
        }
      } catch (err) {
        errors++
        errorFiles.push(file.name)
      }
    }

    const total = uploaded + duplicated + errors

    let message = `Subida completa ✅\n${uploaded} nuevas · ${duplicated} duplicadas · ${total} total`

    if (errors > 0) {
      message += `\n⚠️ Error en: ${errorFiles.join(', ')}`
    }

    setStatus(message)
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-32 p-6 border rounded-xl">
        <h1 className="text-lg font-semibold mb-4">Admin</h1>

        <input
          type="password"
          placeholder="Clave admin"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded mb-4"
        />

        <button
          onClick={login}
          className="w-full bg-black text-white py-2 rounded"
        >
          Entrar
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-xl">
      {/* ===== Crear evento ===== */}
      <div className="mb-8 border-b pb-6">
        <h2 className="text-lg font-semibold mb-2">
          Crear evento
        </h2>

        <input
          type="text"
          placeholder="Nombre del evento"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
          className="w-full border px-3 py-2 rounded mb-3"
        />

        <button
          onClick={async () => {
            if (!eventTitle) return

            setStatus('Creando evento...')

            const res = await fetch('/api/admin/create-event', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title: eventTitle }),
            })

            const data = await res.json()

            if (data.ok) {
              setStatus(`Evento creado ✅ (${data.slug})`)
              setEventTitle('')
            } else {
              setStatus('Error creando evento')
            }
          }}
          className="w-full bg-black text-white py-3 rounded-full"
        >
          Crear evento
        </button>
      </div>
      {/* ===== Fin crear evento ===== */}
      <h1 className="text-xl font-semibold mb-4">
        Admin · Subir fotos del evento
      </h1>
      {/* ===== Selección de evento (E4) ===== */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Evento seleccionado
        </label>

        <select
          className="w-full border px-3 py-2 rounded"
          value={selectedEventSlug}
          onChange={(e) => setSelectedEventSlug(e.target.value)}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.slug}>
              {ev.name} ({ev.slug})
            </option>
          ))}
        </select>
      </div>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(e.target.files ?? null)}
      />

      <button
        onClick={uploadFiles}
        className="w-full bg-black text-white py-3 rounded-full mt-4"
      >
        Subir fotos
      </button>

      <button
        onClick={async () => {
          if (!selectedEventSlug) {
            alert('Selecciona un evento primero')
            return
          }

          setStatus('Indexando fotos...')

          const res = await fetch('/api/admin/index-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_slug: selectedEventSlug,
            }),
          })

          const data = await res.json()
          if (data.ok) {
            const indexed = data.indexedPhotos ?? 0
            const skipped = data.skippedPhotos ?? 0
            const total = indexed + skipped

            setStatus(
              `Indexación lista ✅ (${indexed} nuevas · ${skipped} omitidas · ${total} total)`
            )
          } else {
            setStatus('Error indexando fotos')
          }

        }}
        className="w-full border py-3 rounded-full mt-4"
      >
        Indexar fotos
      </button>

      {status && (
        <p className="text-sm text-gray-600 mt-4">{status}</p>
      )}
    </div>
  )
}
