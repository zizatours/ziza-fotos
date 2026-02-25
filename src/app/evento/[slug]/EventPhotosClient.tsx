'use client'

import { useState } from 'react'
import SelfieUploader from './SelfieUploader'
import AllPhotosGallery from './AllPhotosGallery'

const parseSupabaseStorageObjectUrl = (url: string) => {
  try {
    const u = new URL(url)
    // /storage/v1/object/<scope>/<bucket>/<path>
    const m = u.pathname.match(/\/storage\/v1\/object\/[^/]+\/([^/]+)\/(.+)$/)
    if (!m) return null
    return {
      bucket: decodeURIComponent(m[1]),
      path: decodeURIComponent(m[2]),
    }
  } catch {
    return null
  }
}

const normalizeSelectedImageForCheckout = (value: string): string | null => {
  const v = (value || '').trim()
  if (!v) return null

  // URL completa
  if (/^https?:\/\//i.test(v)) {
    // Si es preview público (watermark), NO sirve para checkout
    if (v.includes('/event-previews/')) return null

    const parsed = parseSupabaseStorageObjectUrl(v)

    // Si no se puede parsear como Supabase Storage, lo dejamos pasar por compatibilidad
    if (!parsed) return v

    // Nunca aceptar bucket de previews como imagen comprable
    if (parsed.bucket === 'event-previews') return null

    const cleanPath = (parsed.path || '').replace(/^\/+/, '')
    if (!cleanPath) return null

    // Bloquear thumbs/covers/webp
    if (
      cleanPath.includes('/thumb/') ||
      cleanPath.includes('/cover/') ||
      cleanPath.toLowerCase().endsWith('.webp')
    ) {
      return null
    }

    return cleanPath
  }

  // Path interno (sin dominio)
  const clean = v.replace(/^\/+/, '')
  if (!clean) return null

  if (
    clean.includes('/thumb/') ||
    clean.includes('/cover/') ||
    clean.toLowerCase().endsWith('.webp')
  ) {
    return null
  }

  return clean
}

export default function EventPhotosClient({ eventSlug }: { eventSlug: string }) {
  const [selected, setSelected] = useState<string[]>([])

  const goCheckout = () => {
    const normalizedImages: string[] = []

    for (const item of selected) {
      const normalized = normalizeSelectedImageForCheckout(item)
      if (!normalized) {
        alert('Encontramos uma imagem de pré-visualização na seleção. Selecione novamente suas fotos.')
        return
      }
      normalizedImages.push(normalized)
    }

    if (normalizedImages.length === 0) {
      alert('Nenhuma foto válida foi selecionada.')
      return
    }

    const payload = { event_slug: eventSlug, images: normalizedImages }

    try {
      localStorage.setItem('ziza_checkout_selection', JSON.stringify(payload))
    } catch {}

    window.location.href = '/checkout'
  }

  return (
    <>
      <SelfieUploader
        eventSlug={eventSlug}
        selected={selected}
        setSelected={setSelected}
        onCheckout={goCheckout}
      />

      <AllPhotosGallery
        eventSlug={eventSlug}
        selected={selected}
        setSelected={setSelected}
        onCheckout={goCheckout}
      />
    </>
  )
}
