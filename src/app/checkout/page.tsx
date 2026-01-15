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
  const unitPrice = 18

  const subtotal = quantity * unitPrice
  const discountPercent =
    quantity >= 10 ? 20 : quantity >= 5 ? 10 : quantity >= 2 ? 5 : 0
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2)
  const total = +(subtotal - discountAmount).toFixed(2)

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
    const raw = localStorage.getItem('ziza_checkout_selection')
    if (!raw) return
    const data = JSON.parse(raw)
    setImages(data.images || [])
    setEventSlug(data.event_slug || null)
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
              Solo tomará unos segundos
            </p>

            {/* CONTACTO */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-2 text-gray-900">
                Contacto
              </h2>

              <input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 mb-2 text-gray-900"
              />

              <input
                type="email"
                placeholder="Confirmar correo electrónico"
                value={emailConfirm}
                onChange={e => setEmailConfirm(e.target.value)}
                className="w-full border rounded-lg px-4 py-3 mb-4 text-gray-900"
              />

              <p className="text-xs text-gray-500">
                Te enviaremos aquí el acceso a tus fotos (por si cierras esta ventana)
              </p>
            </div>

            {/* PAGO */}
            <div className="mb-8">
              <h2 className="text-sm font-medium mb-3 text-gray-900">
                Pago
              </h2>

              <div className="border rounded-lg p-4 flex items-center gap-3">
                <input type="radio" checked readOnly />
                <span className="text-sm text-gray-600">PayPal</span>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                PayPal permite pagar con tarjeta o cuenta PayPal
              </p>
            </div>

            {/* CTA / PAYPAL */}
            {!paypalClientId ? (
              <div className="text-sm text-red-600">
                Falta configurar <b>NEXT_PUBLIC_PAYPAL_CLIENT_ID</b> en Vercel.
              </div>
            ) : !canPay ? (
              <button
                disabled
                className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
              >
                Continuar al pago
              </button>
            ) : (
              <PayPalScriptProvider
                options={{ clientId: paypalClientId, currency: 'BRL', intent: 'capture' }}
              >
                <div className="w-full">
                  <PayPalButtons
                    style={{ layout: 'vertical' }}
                    createOrder={async () => {
                      try {
                        setLoading(true)

                        const res = await fetch('/api/paypal/create-order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            total,
                            currency: 'BRL',
                            event_slug: eventSlug,
                            images,
                            email,
                          }),
                        })

                        const data = await res.json().catch(() => ({}))
                        setLoading(false)

                        console.log('CREATE ORDER status:', res.status, data)

                        if (!res.ok || !data?.id) {
                          alert('Error creando orden PayPal. Revisa consola (F12) y logs de Vercel.')
                          throw new Error('create-order failed')
                        }

                        return data.id
                      } catch (e) {
                        setLoading(false)
                        console.log('CREATE ORDER EXCEPTION:', e)
                        alert('No se pudo iniciar PayPal (createOrder falló).')
                        throw e
                      }
                    }}
                    onError={(err) => {
                      console.log('PAYPAL BUTTONS ERROR:', err)
                      alert('PayPal dio un error. Revisa consola (F12).')
                    }}
                    onApprove={async (data: { orderID?: string }) => {
                      const orderID = data?.orderID
                      if (!orderID) {
                        alert('No se recibió orderID de PayPal.')
                        return
                      }

                      setLoading(true)

                      const res = await fetch('/api/paypal/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderID,
                          event_slug: eventSlug,
                          images,
                          email,
                        }),
                      })

                      const out = await res.json()
                      setLoading(false)

                      if (!res.ok) {
                        console.log('CAPTURE ERROR:', out)
                        alert('Hubo un problema al confirmar el pago.')
                        return
                      }

                      console.log('PAGO OK:', out)
                      alert('¡Pago confirmado! (falta implementar entrega/descarga)')
                    }}
                  />
                </div>
              </PayPalScriptProvider>
            )}

            <p className="text-xs text-gray-400 mt-3 text-center">
              No se realizará ningún cargo sin tu confirmación
            </p>
          </section>

          {/* COLUMNA DERECHA */}
          <aside className="bg-gray-50 rounded-xl p-6 h-fit text-gray-900">
            <h2 className="text-sm font-medium mb-4">
              Resumen de tu selección
            </h2>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {images
                .filter(Boolean)
                .slice(0, 6)
                .map((url, i) => (
                  <img
                    key={i}
                    src={getPreviewUrl(url)}
                    alt="Foto seleccionada"
                    className="aspect-square object-cover rounded-md"
                  />
                ))}
            </div>

            <div className="text-sm space-y-2 mb-4">
              <div className="flex justify-between">
                <span>{quantity} fotos</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              {discountPercent > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Descuento {discountPercent}%</span>
                  <span>-R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between font-medium border-t pt-2">
                <span>Total</span>
                <span>R$ {total.toFixed(2)} BRL</span>
              </div>
            </div>

            <p className="text-xs text-gray-500">
              Tus fotos son privadas. Solo tú podrás descargarlas después del pago.
            </p>
          </aside>

        </div>
      </div>
    </main>
  )
}
