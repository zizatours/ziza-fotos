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

  // Estado de pago: cuando está true, congelamos la propina y mostramos PayPal
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Método de pago (PayPal o Tarjeta vía PayPal)
  const [payMethod, setPayMethod] = useState<'paypal' | 'card'>('paypal')

  // Propina “congelada” usada para crear/capturar la orden (la real del pago)
  const [tipApplied, setTipApplied] = useState(0)

  // Key para forzar “reset” del UI de PayPal al editar
  const [paypalKey, setPaypalKey] = useState(0)

  const tip = useMemo(() => {
    const raw = (tipInput || '').replace(',', '.').trim()
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(n, 500)
  }, [tipInput])

  const subtotal = useMemo(() => {
    return +(quantity * unitPrice).toFixed(2)
  }, [quantity, unitPrice])

  const effectiveTip = useMemo(() => {
    return paymentOpen ? tipApplied : tip
  }, [paymentOpen, tipApplied, tip])

  const total = useMemo(() => {
    return +(subtotal + effectiveTip).toFixed(2)
  }, [subtotal, effectiveTip])

  // ✅ PayPal Client ID (PUBLIC)
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''

  // ✅ Checkout previews:
  // - Si el string ya es una URL pública (ideal: event-previews), úsala directo
  // - Si el string es un path (ej: eventos/<slug>/original/<file>), usar /api/preview?path=...
  //   (porque event-photos es PRIVADO y /api/preview puede leer con service role)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const previewsBucket = 'event-previews'

  const toPublicEventPreviewsUrl = (path: string) => {
    if (!path) return ''
    if (!supabaseUrl) return path
    const clean = path.replace(/^\/+/, '')
    return `${supabaseUrl}/storage/v1/object/public/${previewsBucket}/${clean}`
  }

  // Extrae el "path dentro del bucket" desde una URL de Supabase Storage.
  // Ej: https://.../storage/v1/object/public/event-photos/eventos/slug/original/a.jpg
  //  -> { bucket: "event-photos", path: "eventos/slug/original/a.jpg" }
  const parseSupabaseStorageObjectUrl = (url: string) => {
    try {
      const u = new URL(url)
      // match: /storage/v1/object/(public|sign|...)/<bucket>/<path>
      const m = u.pathname.match(/\/storage\/v1\/object\/[^/]+\/([^/]+)\/(.+)$/)
      if (!m) return null
      return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) }
    } catch {
      return null
    }
  }

  // Si tenemos originalPath, armamos thumb esperado en event-previews
  const thumbFromOriginalPath = (originalPath: string, slug: string | null) => {
    if (!slug) return ''
    const file = originalPath.split('/').pop() || ''
    const base = file.replace(/\.[^.]+$/, '')
    if (!base) return ''
    return toPublicEventPreviewsUrl(`eventos/${slug}/thumb/${base}.webp`)
  }

  const getCheckoutPreviewSrc = (value: string) => {
    if (!value) return ''

    // 1) Si es URL completa:
    if (/^https?:\/\//i.test(value)) {
      // Si ya es de event-previews (público), úsala tal cual
      if (value.includes('/event-previews/')) return value

      // Si es una URL de Supabase Storage (event-photos u otro), conviértela a path y usa ?path=
      const parsed = parseSupabaseStorageObjectUrl(value)
      if (parsed?.path) {
        const thumb = parsed.path.includes('/original/')
          ? thumbFromOriginalPath(parsed.path, eventSlug)
          : ''
        return thumb || `/api/preview?path=${encodeURIComponent(parsed.path)}&w=420&q=60&fmt=webp`
      }

      // Último recurso: src= (solo funciona si esa URL es accesible)
      return `/api/preview?src=${encodeURIComponent(value)}&w=420&q=60&fmt=webp`
    }

    // 2) Si parece thumb webp (público)
    if (value.includes('/thumb/') || value.endsWith('.webp')) {
      return toPublicEventPreviewsUrl(value)
    }

    // 3) Si es path de original (privado): intentar thumb esperado y si no, preview por path
    const clean = value.replace(/^\/+/, '')
    const thumb = clean.includes('/original/') ? thumbFromOriginalPath(clean, eventSlug) : ''
    return thumb || `/api/preview?path=${encodeURIComponent(clean)}&w=420&q=60&fmt=webp`
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

              <div className="space-y-2">
                <label className="border rounded-lg p-4 flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === 'paypal'}
                    onChange={() => setPayMethod('paypal')}
                  />
                  <span className="text-sm text-gray-600">PayPal</span>
                </label>

                <label className="border rounded-lg p-4 flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="payMethod"
                    checked={payMethod === 'card'}
                    onChange={() => setPayMethod('card')}
                  />
                  <span className="text-sm text-gray-600">
                    Cartão de crédito/débito
                  </span>
                </label>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Você pode pagar com sua conta PayPal ou com cartão via PayPal.
              </p>
            </div>

            {/* PROPINA */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-2 text-gray-900">Gorjeta (opcional)</h2>
              <input
                translate="no"
                disabled={paymentOpen}
                className="notranslate w-full border rounded-lg px-4 py-3 text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                inputMode="decimal"
                placeholder="0.00"
                value={tipInput}
                onChange={(e) => setTipInput(e.target.value)}
              />
              {paymentOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOpen(false)
                    setPaypalKey((k) => k + 1) // fuerza reset del UI PayPal
                  }}
                  className="mt-2 text-sm underline text-gray-700"
                >
                  Editar gorjeta
                </button>
              )}
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
                key={paypalKey}
                options={{
                  clientId: paypalClientId,
                  currency: 'BRL',
                  intent: 'capture',
                  components: 'buttons',
                  'enable-funding': 'card',
                }}
                deferLoading={!canPay || !paymentOpen}
              >
                {!canPay ? (
                  <button
                    disabled
                    className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
                  >
                    Continuar para o pagamento
                  </button>
                ) : !paymentOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Congelamos la propina para ESTA sesión de pago
                      setTipApplied(tip)
                      setPaymentOpen(true)
                    }}
                    className="w-full bg-black text-white rounded-full py-4 text-sm"
                  >
                    Continuar para o pagamento
                  </button>
                ) : (
                  <div translate="no" lang="zxx" className="notranslate">
                    <PayPalButtons
                      fundingSource={payMethod}
                      key={`${payMethod}-${paypalClientId}-${eventSlug || 'no-event'}-${paypalKey}`}
                      style={{ layout: 'vertical' }}
                      createOrder={async () => {
                        console.log('PAYPAL createOrder start', { total, eventSlug, imagesCount: images.length, email, tipApplied })

                        const res = await fetch('/api/paypal/create-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            currency: 'BRL',
                            event_slug: eventSlug,
                            images,
                            email,
                            tip: tipApplied,
                          }),
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
                            tip: tipApplied,
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
                        // opcional: permitir editar al cancelar
                        setPaymentOpen(false)
                        setPaypalKey((k) => k + 1)
                      }}
                    />
                  </div>
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
                    src={getCheckoutPreviewSrc(url)}
                    onError={(e) => {
                      // Si el thumb público falló, cae al preview por path si podemos inferirlo
                      const v = url
                      if (!v) return
                      const img = e.currentTarget

                      // Si era URL completa de Supabase, usar path=
                      if (/^https?:\/\//i.test(v)) {
                        const parsed = parseSupabaseStorageObjectUrl(v)
                        if (parsed?.path) img.src = `/api/preview?path=${encodeURIComponent(parsed.path)}&w=420&q=60&fmt=webp`
                        return
                      }

                      // Si era path original, usar path=
                      const clean = v.replace(/^\/+/, '')
                      if (!img.src.includes('/api/preview?path=')) {
                        img.src = `/api/preview?path=${encodeURIComponent(clean)}&w=420&q=60&fmt=webp`
                      }
                    }}
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
                <span>R$ {effectiveTip.toFixed(2)}</span>
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
