'use client'

import { useState } from 'react'

export default function AdminPage() {
  const [files, setFiles] = useState<FileList | null>(null)
  const [status, setStatus] = useState('')

  const uploadFiles = async () => {
    if (!files) return

    setStatus('Subiendo fotos...')

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)

      await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
    }

    setStatus('Fotos subidas correctamente ✅')
  }

  return (
    <div className="max-w-md mx-auto mt-20 p-6 border rounded-xl">
      <h1 className="text-xl font-semibold mb-4">
        Admin · Subir fotos del evento
      </h1>

      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(e.target.files)}
      />

      <button
        onClick={uploadFiles}
        className="w-full bg-black text-white py-3 rounded-full mt-4"
      >
        Subir fotos
      </button>

      {status && (
        <p className="text-sm text-gray-600 mt-4">{status}</p>
      )}
    </div>
  )
}
