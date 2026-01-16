'use client'

import { useState } from 'react'

export default function ResendOrderEmail({ adminKey }: { adminKey: string }) {
  const [orderId, setOrderId] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const canSubmit = orderId.trim().length > 0 && !loading

  async function handleSend() {
    setLoading(true)
    setMsg(null)

    try {
      const res = await fetch('/api/admin/orders/resend-email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-key': adminKey || '',
        },
        body: JSON.stringify({
          orderId: orderId.trim(),
          email: email.trim() ? email.trim() : undefined,
        }),
      })

      const data = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        setMsg(`❌ Error: ${data?.error || 'desconocido'}`)
        return
      }

      setMsg(`✅ Enviado a ${data?.email || email || 'correo de la orden'}`)
    } catch (e: any) {
      setMsg(`❌ Error: ${e?.message || 'fallo de red'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/15 p-4">
      <h3 className="text-base font-semibold mb-1">Reenviar correo</h3>
      <p className="text-sm text-gray-600 dark:text-zinc-300 mb-4">
        Pega el <span className="font-mono">orderId</span> (de <span className="font-mono">/gracias?order=...</span>) y opcionalmente corrige el
        email.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Order ID</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="ej: 3f2c2a8e-...."
            className="w-full rounded-xl border border-black/15 dark:border-white/20 bg-white dark:bg-zinc-950 px-3 py-2 text-sm
                       text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Email nuevo (opcional)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@correo.com"
            className="w-full rounded-xl border border-black/15 dark:border-white/20 bg-white dark:bg-zinc-950 px-3 py-2 text-sm
                       text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSubmit}
          className="rounded-full px-5 py-2 text-sm bg-black text-white disabled:opacity-50
                     dark:bg-white dark:text-black"
        >
          {loading ? 'Enviando…' : 'Reenviar correo'}
        </button>

        {msg && <p className="text-sm">{msg}</p>}
      </div>
    </div>
  )
}
