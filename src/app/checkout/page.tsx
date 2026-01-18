'use client'
import { useEffect, useMemo, useState } from 'react'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'

export default function CheckoutPage() {
  const [images, setImages] = useState<string[]>([])
  const [eventSlug, setEventSlug] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const quantity = images.length
  const unitPrice = 10

  // Propina (input tipo texto para soportar coma o punto)
  const [tipInput, setTipInput] = useState('0')

  const tip = useMemo(() => {
    const raw = (tipInput || '').replace(',', '.').trim()
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(n, 500)
  }, [tipInput])

  const subtotal = useMemo(() => {
    return +(quantity * unitPrice).toFixed(2)
  }, [quantity, unitPrice])

  const total = useMemo(() => {
    return +(subtotal + tip).toFixed(2)
  }, [subtotal, tip])

  // ✅ PayPal Client ID (PUBLIC)
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''

  // ✅ Para watermark: soporta images como "path" (evento/archivo.jpg) o como URL completa
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const bucket = 'event-photos'

  const toPublicUrl = (pathOrUrl: string) => {
    if (!pathOrUrl) return ''
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
    if (!supabaseUrl) return pathOrUrl // fallback
    const clean = pathOrUrl.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${clean}`
  }

  const getPreviewUrl = (pathOrUrl: string) => {
    const publicUrl = toPublicUrl(pathOrUrl)
    return `/api/preview?src=${encodeURIComponent(publicUrl)}`
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ziza_checkout_selection')
      if (!raw) return

      const data = JSON.parse(raw)

      const imgs = Array.isArray(data?.images)
        ? data.images.filter((x: any) => typeof x === 'string' && x.length > 0)
        : []

      const slug = typeof data?.event_slug === 'string' && data.event_slug.length > 0
        ? data.event_slug
        : null

      // Si está incompleto o corrupto, limpiamos para evitar “total 0”
      if (!slug || imgs.length === 0) {
        localStorage.removeItem('ziza_checkout_selection')
        return
      }

      setImages(imgs)
      setEventSlug(slug)
    } catch (err) {
      // JSON corrupto u otra excepción
      localStorage.removeItem('ziza_checkout_selection')
    }
  }, [])

  const canPay = useMemo(() => {
    return (
      !loading &&
      !!email &&
      email === emailConfirm &&
      images.length > 0 &&
      !!paypalClientId
    )
  }, [loading, email, emailConfirm, images.length, paypalClientId])

  const missingSelection = images.length === 0 || !eventSlug

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* COLUMNA IZQUIERDA */}
          <section>
            <h1 className="text-2xl font-semibold mb-2 text-gray-900">
              Finalizar compra
            </h1>

            <p className="text-sm text-gray-500 mb-8">
              Levará apenas alguns segundos
            </p>

            {missingSelection && (
              <div className="mb-8 border border-yellow-200 bg-yellow-50 rounded-xl p-4 text-sm text-gray-900">
                <div className="font-medium mb-1">Nenhuma foto selecionada</div>
                <div className="text-gray-700">
                  Volte ao evento e selecione suas fotos novamente.
                </div>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="mt-3 inline-flex items-center justify-center rounded-full bg-black text-white px-4 py-2 text-xs"
                >
                  Voltar
                </button>
              </div>
            )}

            {/* CONTACTO */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-2 text-gray-900">
                Contato
              </h2>

              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 mb-2 text-gray-900"
              />

              <input
                type="email"
                placeholder="Confirmar e-mail"
                value={emailConfirm}
                onChange={e => setEmailConfirm(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 mb-4 text-gray-900"
              />

              <p className="text-xs text-gray-500">
                Vamos enviar aqui o acesso às suas fotos (caso você feche esta janela)
              </p>
            </div>

            {/* PAGO */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-3 text-gray-900">
                Pagamento
              </h2>

              <div className="border rounded-lg p-4 flex items-center gap-3">
                <input type="radio" checked readOnly />
                <span className="text-sm text-gray-600">PayPal</span>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                O PayPal permite pagar com cartão ou com sua conta PayPal
              </p>
            </div>

            {/* PROPINA */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-2 text-gray-900">Gorjeta (opcional)</h2>
              <input
                translate="no"
                className="notranslate w-full border rounded-lg px-4 py-3 text-gray-900"
                inputMode="decimal"
                placeholder="0.00"
                value={tipInput}
                onChange={(e) => setTipInput(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">
                Se você quiser apoiar o fotógrafo, pode adicionar uma gorjeta. (Opcional)
              </p>
            </div>

            {process.env.NODE_ENV !== 'production' && (
              <div className="text-xs opacity-70 mb-2">
                paypalClientId: {paypalClientId ? `OK (${paypalClientId.slice(0, 6)}...)` : 'Vazio'}
              </div>
            )}
            {/* CTA / PAYPAL */}
            {!paypalClientId ? (
              <button
                disabled
                className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
              >
                PayPal ainda não foi configurado
              </button>
            ) : (
              <PayPalScriptProvider
                options={{ clientId: paypalClientId, currency: 'BRL', intent: 'capture' }}
              >
                {!canPay ? (
                  <button
                    disabled
                    className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
                  >
                    Continuar para o pagamento
                  </button>
                ) : (
                  <PayPalButtons
                    key={`${paypalClientId}-${eventSlug || 'no-event'}`}
                    style={{ layout: 'vertical' }}
                    createOrder={async () => {
                      console.log('PAYPAL createOrder start', { total, eventSlug, imagesCount: images.length, email })

                      const res = await fetch('/api/paypal/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currency: 'BRL', event_slug: eventSlug, images, email, tip }),
                      })

                      const data = await res.json().catch(() => ({} as any))
                      console.log('PAYPAL createOrder response', res.status, data)

                      if (!res.ok || !data?.id) {
                        alert('Não foi possível criar o pedido no PayPal.')
                        throw new Error('create-order failed')
                      }

                      return data.id
                    }}

                    onApprove={async (data: { orderID?: string }) => {
                      const orderID = data?.orderID
                      if (!orderID) return

                      const res = await fetch('/api/paypal/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderID,
                          event_slug: eventSlug,
                          images,
                          email,
                          tip, // nuevo
                          currency: 'BRL',
                        }),
                      })

                      const out = await res.json().catch(() => ({} as any))

                      if (!res.ok) {
                        console.log('CAPTURE ERROR:', out)
                        alert('Houve um problema ao confirmar o pagamento.')
                        return
                      }

                      alert('Pagamento confirmado!')
                      try { localStorage.removeItem('ziza_checkout_selection') } catch {}
                      window.location.href = `/gracias?order=${encodeURIComponent(out.order_id)}`
                    }}
                    onError={(err) => {
                      console.log('PAYPAL BUTTONS ERROR:', err)
                      alert('O PayPal apresentou um erro.')
                    }}
                    onCancel={() => {
                      console.log('PAYPAL cancel (popup closed by user or blocked)')
                      alert('O PayPal foi fechado/cancelado. Verifique se o navegador está bloqueando pop-ups.')
                    }}
                  />
                )}
              </PayPalScriptProvider>
            )}


            <p className="text-xs text-gray-400 mt-3 text-center">
              Nenhuma cobrança será realizada sem a sua confirmação
            </p>
          </section>

          {/* COLUMNA DERECHA */}
          <aside
            translate="no"
            lang="zxx"
            className="notranslate bg-gray-50 rounded-xl p-6 h-fit text-gray-900"
          >
            <h2 className="text-sm font-medium mb-4">
              Resumo da sua seleção
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {images
                .filter(Boolean)
                .slice(0, 6)
                .map((url, i) => (
                  <img
                    key={i}
                    src={getPreviewUrl(url)}
                    alt="Foto selecionada"
                    className="aspect-square object-cover rounded-md"
                  />
                ))}
            </div>

            <div className="text-sm space-y-2 mb-4">
              <div className="flex justify-between">
                <span>{quantity} fotos</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span>Gorjeta (opcional)</span>
                <span>R$ {tip.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-medium border-t pt-2">
                <span>Total</span>
                <span>R$ {total.toFixed(2)} BRL</span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Suas fotos são privadas. Apenas você poderá baixá-las após o pagamento.
            </p>
          </aside>

        </div>
      </div>
    </main>
  )
}
