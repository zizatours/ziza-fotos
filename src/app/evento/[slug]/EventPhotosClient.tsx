'use client'

import { useState } from 'react'
import SelfieUploader from './SelfieUploader'
import AllPhotosGallery from './AllPhotosGallery'

export default function EventPhotosClient({ eventSlug }: { eventSlug: string }) {
  const [selected, setSelected] = useState<string[]>([])

  const goCheckout = () => {
    const payload = { event_slug: eventSlug, images: selected }
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
