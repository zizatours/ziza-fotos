import { Suspense } from 'react'
import GraciasClient from './GraciasClient'

export default function GraciasPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white">
          <div className="max-w-2xl mx-auto px-6 py-16 text-center">
            <p className="text-gray-600">Cargando…</p>
          </div>
        </main>
      }
    >
      <GraciasClient />
    </Suspense>
  )
}
