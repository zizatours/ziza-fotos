'use client'
import { useEffect, useState } from 'react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

export default function CheckoutPage() {
  const [images, setImages] = useState<string[]>([])
  const [eventSlug, setEventSlug] = useState<string | null>(null)
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || ''
  
  const getPreviewUrl = (url: string) =>
    `/api/preview?path=${encodeURIComponent(url)}`

  const quantity = images.length
  const unitPrice = 18

  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const subtotal = quantity * unitPrice
  const discountPercent =
    quantity >= 10 ? 20 : quantity >= 5 ? 10 : quantity >= 2 ? 5 : 0
  const discountAmount = +(subtotal * (discountPercent / 100)).toFixed(2)
  const total = +(subtotal - discountAmount).toFixed(2)

  useEffect(() => {
    const raw = localStorage.getItem('ziza_checkout_selection')

    if (!raw) return

    const data = JSON.parse(raw)

    setImages(data.images || [])
    setEventSlug(data.event_slug || null)
  }, [])

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
                Te enviaremos aquí el acceso a tus fotos
                (por si cierras esta ventana)
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

            {/* CTA (PayPal) */}
            {(!paypalClientId || !email || email !== emailConfirm || images.length === 0) ? (
              <button
                disabled
                className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
              >
                Continuar al pago
              </button>
            ) : (
              <PayPalScriptProvider
                options={{
                  clientId: paypalClientId,
                  currency: 'BRL',
                  intent: 'capture',
                }}
              >
                <div className="w-full">
                  <PayPalButtons
                    style={{ layout: 'vertical' }}
                    createOrder={async () => {
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

                      const data = await res.json()
                      setLoading(false)

                      if (!res.ok) throw new Error('No se pudo crear la orden de PayPal')
                      return data.id
                    }}
                    onApprove={async (data) => {
                      setLoading(true)

                      const res = await fetch('/api/paypal/capture-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          orderID: data.orderID,
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

                      // TODO: aquí puedes redirigir a /gracias o mostrar “Pago ok”
                      console.log('PAGO OK:', out)
                      alert('¡Pago confirmado! (Ahora toca habilitar entrega/descarga)')
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

            {/* MINI GRID (placeholder visual) */}
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

            {/* PRECIOS */}
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
              Tus fotos son privadas.  
              Solo tú podrás descargarlas después del pago.
            </p>
          </aside>

        </div>
      </div>
    </main>
  )
}
