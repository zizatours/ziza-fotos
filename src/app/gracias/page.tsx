import { Suspense } from 'react'
import GraciasClient from './GraciasClient'

export const metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-video-preview": -1,
      "max-image-preview": "none",
      "max-snippet": -1,
    },
  },
}

export default function GraciasPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white">
          <div className="max-w-2xl mx-auto px-6 py-16 text-center">
            <p className="text-gray-600">Carregando…</p>
          </div>
        </main>
      }
    >
      <GraciasClient />
    </Suspense>
  )
}
