'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'

export default function CheckoutPage() {
  const [images, setImages] = useState<string[]>([])
  const [eventSlug, setEventSlug] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const quantity = images.length
  const unitPrice = 15

  // Propina (input tipo texto para soportar coma o punto)
  const [tipInput, setTipInput] = useState('0')

  // Estado de pago: cuando está true, congelamos la propina y mostramos PayPal
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Método de pago (PayPal o Tarjeta vía PayPal)
  const [payMethod, setPayMethod] = useState<'paypal' | 'card' | 'getnet'>('paypal')

  // Propina “congelada” usada para crear/capturar la orden (la real del pago)
  const [tipApplied, setTipApplied] = useState(0)

  // Key para forzar “reset” del UI de PayPal al editar
  const [paypalKey, setPaypalKey] = useState(0)

  // ===== GETNET (BR) =====
  // TEMP: deshabilitado hasta implementar webhook/confirmación server-to-server
  const GETNET_TEMP_DISABLED = true

  const getnetSellerId = process.env.NEXT_PUBLIC_GETNET_SELLER_ID || ''
  const getnetLoaderUrl = process.env.NEXT_PUBLIC_GETNET_LOADER_URL || ''

  const [getnetSession, setGetnetSession] = useState<null | {
    access_token: string
    order_id: string
    customer_id: string
    amount: string
  }>(null)

  // Datos mínimos BR
  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('') // CPF requerido por Getnet Checkout Iframe
  // Address (para Getnet Checkout)
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [stateUF, setStateUF] = useState('') // "SP", "RJ", etc (2 letras)
  const [complement, setComplement] = useState('')

  // Para forzar re-montaje del loader
  const [getnetMountKey, setGetnetMountKey] = useState(0)

  // Re-abrir Getnet si el usuario cerró el modal (sin recargar la página)
  const getnetReopenPendingRef = useRef(false)
  const ignoreNextGetnetClickRef = useRef(false)

  const onGetnetLoaderLoaded = useCallback(() => {
    // Solo auto-click si estamos rearmando el loader para re-abrir
    if (!getnetReopenPendingRef.current) return
    getnetReopenPendingRef.current = false

    // Evita que nuestro onClick vuelva a reiniciar (loop)
    ignoreNextGetnetClickRef.current = true

    // Deja que el loader termine de bindear el botón y luego dispara el click real
    setTimeout(() => {
      const btn = document.querySelector<HTMLButtonElement>('.open-getnet-checkout')
      btn?.click()
    }, 0)
  }, [])

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

  // Normaliza valores de la selección del checkout a "path original" cuando es posible.
  // Rechaza previews/thumbs/covers (watermark) para evitar compras rotas.
  const normalizeCheckoutSelectionImage = (value: string): string | null => {
    const v = (value || '').trim()
    if (!v) return null

    // Caso URL completa
    if (/^https?:\/\//i.test(v)) {
      // Preview público con watermark -> inválido para checkout
      if (v.includes('/event-previews/')) return null

      const parsed = parseSupabaseStorageObjectUrl(v)

      // Si no es una URL de Supabase Storage, la dejamos pasar (compatibilidad legacy)
      if (!parsed) return v

      // Si viene del bucket público de previews -> inválido
      if (parsed.bucket === 'event-previews') return null

      const cleanPath = (parsed.path || '').replace(/^\/+/, '')
      if (!cleanPath) return null

      // Si el path interno parece thumb/cover/webp -> inválido
      if (
        cleanPath.includes('/thumb/') ||
        cleanPath.includes('/cover/') ||
        cleanPath.toLowerCase().endsWith('.webp')
      ) {
        return null
      }

      return cleanPath
    }

    // Caso path dentro del bucket
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

      const rawImgs = Array.isArray(data?.images)
        ? data.images.filter((x: any) => typeof x === 'string' && x.length > 0)
        : []

      const slug = typeof data?.event_slug === 'string' && data.event_slug.length > 0
        ? data.event_slug
        : null

      let hasInvalidPreviewSelection = false
      const imgs: string[] = []

      for (const raw of rawImgs) {
        const normalized = normalizeCheckoutSelectionImage(raw)
        if (!normalized) {
          hasInvalidPreviewSelection = true
          break
        }
        imgs.push(normalized)
      }

      // Si está incompleto, corrupto o contiene previews/thumbs con watermark, limpiamos.
      if (!slug || imgs.length === 0 || hasInvalidPreviewSelection) {
        console.warn('[checkout] ziza_checkout_selection inválido: contiene previews/thumbs o datos incompletos')
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
    const baseOk =
      !loading &&
      !!email &&
      email === emailConfirm &&
      images.length > 0

    if (!baseOk) return false

    if (payMethod === 'getnet') {
      const cpfOk = cpf.replace(/\D/g, '').length === 11
      const zipOk = cep.replace(/\D/g, '').length === 8
      const stateOk = (stateUF || '').trim().length === 2

      return (
        !!getnetSellerId &&
        !!getnetLoaderUrl &&
        fullName.trim().length > 3 &&
        cpfOk &&
        !!email &&

        street.trim().length > 1 &&
        addressNumber.trim().length > 0 &&
        district.trim().length > 1 &&
        city.trim().length > 1 &&
        stateOk &&
        zipOk
      )
    }

    return !!paypalClientId
  }, [
  loading,
  email,
  emailConfirm,
  images.length,
  paypalClientId,
  payMethod,
  getnetSellerId,
  getnetLoaderUrl,
  fullName,
  cpf,
  cep,
  street,
  addressNumber,
  district,
  city,
  stateUF,
  ])

  const missingSelection = images.length === 0 || !eventSlug

  const callbackUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''

    const base = `${window.location.origin}/gracias?getnet=1`

    if (!getnetSession?.order_id) return base

    return `${base}&getnet_order=${encodeURIComponent(getnetSession.order_id)}`
  }, [getnetSession?.order_id])

  const itemsJson = useMemo(() => {
    return JSON.stringify([
      {
        name: 'Fotos digitais',
        description: eventSlug ? `Evento ${eventSlug}` : 'Fotos do evento',
        value: Math.round(unitPrice * 100), // centavos (usa el precio real)
        quantity: images.length,
        sku: eventSlug || 'ziza',
      },
    ])
  }, [eventSlug, images.length, unitPrice])

  //const paypalFundingSource = (payMethod === 'card' ? 'card' : 'paypal') as 'paypal' | 'card'

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
                    checked={payMethod === 'paypal' || payMethod === 'card'}
                    onChange={() => setPayMethod('paypal')}
                  />
                  <span className="text-sm text-gray-600">
                    PayPal
                  </span>
                </label>

                {!GETNET_TEMP_DISABLED && (
                  <label className="border rounded-lg p-4 flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payMethod"
                      checked={payMethod === 'getnet'}
                      onChange={() => setPayMethod('getnet')}
                    />
                    <span className="text-sm text-gray-600">
                      Cartão / Pix
                    </span>
                  </label>
                )}
              </div>

              {GETNET_TEMP_DISABLED && (
                <p className="text-xs text-amber-700 mt-2">
                  Pix e Getnet estão temporariamente indisponíveis. Use PayPal ou cartão via PayPal.
                </p>
              )}

              {payMethod === 'getnet' && !GETNET_TEMP_DISABLED && (
                <div className="mt-4 grid grid-cols-1 gap-3">
                  {/* Nome completo */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome completo</label>
                    <input
                      className="w-full border rounded-lg px-3 py-3 text-sm"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Maria Silva"
                      autoComplete="name"
                      disabled={paymentOpen}
                    />
                  </div>

                  {/* CPF */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CPF</label>
                    <input
                      className="w-full border rounded-lg px-3 py-3 text-sm"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      autoComplete="off"
                      disabled={paymentOpen}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Obrigatório para pagamento com Getnet.
                    </p>
                  </div>

                  {/* CEP */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">CEP</label>
                    <input
                      className="w-full border rounded-lg px-3 py-3 text-sm"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      disabled={paymentOpen}
                    />
                  </div>

                  {/* Rua + Número */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Rua</label>
                      <input
                        className="w-full border rounded-lg px-3 py-3 text-sm"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Av. Paulista"
                        autoComplete="address-line1"
                        disabled={paymentOpen}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">Número</label>
                      <input
                        className="w-full border rounded-lg px-3 py-3 text-sm"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        placeholder="123"
                        autoComplete="address-line2"
                        disabled={paymentOpen}
                      />
                    </div>
                  </div>

                  {/* Bairro */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bairro</label>
                    <input
                      className="w-full border rounded-lg px-3 py-3 text-sm"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Centro"
                      autoComplete="address-level3"
                      disabled={paymentOpen}
                    />
                  </div>

                  {/* Cidade + UF */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                      <input
                        className="w-full border rounded-lg px-3 py-3 text-sm"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        autoComplete="address-level2"
                        disabled={paymentOpen}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs text-gray-500 mb-1">UF</label>
                      <input
                        className="w-full border rounded-lg px-3 py-3 text-sm uppercase"
                        value={stateUF}
                        onChange={(e) => setStateUF(e.target.value.toUpperCase().slice(0, 2))}
                        placeholder="SP"
                        autoComplete="address-level1"
                        disabled={paymentOpen}
                      />
                    </div>
                  </div>

                  {/* Complemento (opcional) */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Complemento (opcional)</label>
                    <input
                      className="w-full border rounded-lg px-3 py-3 text-sm"
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Apto 12"
                      autoComplete="off"
                      disabled={paymentOpen}
                    />
                  </div>
                </div>
              )}

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
            {/* CTA / PAYPAL / GETNET */}

            {/* ====== GETNET CTA (no depende de PayPal) ===== */}
            {payMethod === 'getnet' && !GETNET_TEMP_DISABLED ? (
              <>
                {!canPay ? (
                  <>
                    <button
                      disabled
                      className="w-full bg-black text-white rounded-full py-4 text-sm disabled:opacity-40"
                    >
                      Continuar para o pagamento
                    </button>

                    <p className="mt-2 text-xs text-gray-500">
                      Complete e-mail, nome, CPF e endereço (CEP, rua, número, bairro, cidade e UF) para continuar.
                    </p>
                  </>
                ) : !paymentOpen ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setTipApplied(tip)
                      setPaymentOpen(true)

                      setLoading(true)
                      try {
                        const res = await fetch('/api/getnet/session', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            images,
                            tip,
                            unit_price: unitPrice,
                            event_slug: eventSlug,
                            email,
                          }),
                        })

                        const data = await res.json().catch(() => ({} as any))

                        if (!res.ok || !data?.access_token || !data?.order_id || !data?.customer_id || !data?.amount) {
                          console.log('GETNET session error', res.status, data)
                          alert('Não foi possível iniciar o pagamento com Getnet.')
                          setPaymentOpen(false)
                          return
                        }

                        setGetnetSession(data)
                        setGetnetMountKey((k) => k + 1)
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="w-full bg-black text-white rounded-full py-4 text-sm"
                  >
                    Continuar para o pagamento
                  </button>
                ) : (
                  <div translate="no" lang="zxx" className="notranslate">
                    {!getnetSession ? (
                      <p className="text-sm text-gray-600">Preparando pagamento Getnet...</p>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            // fuerza reinit del loader para que el botón vuelva a enganchar después de cerrar
                            setGetnetMountKey((k) => k + 1)
                          }}
                          className="open-getnet-checkout w-full bg-black text-white rounded-full py-4 text-sm"
                        >
                          Pagar com Getnet
                        </button>

                        <GetnetLoader
                          key={`${getnetMountKey}-${getnetSession.order_id}`}
                          loaderUrl={getnetLoaderUrl}
                          sellerId={getnetSellerId}
                          token={getnetSession.access_token}
                          amount={getnetSession.amount}
                          customerId={getnetSession.customer_id}
                          orderId={getnetSession.order_id}
                          fullName={fullName}
                          cpf={cpf}
                          email={email}
                          cep={cep}
                          street={street}
                          number={addressNumber}
                          district={district}
                          city={city}
                          state={stateUF}
                          complement={complement}
                          itemsJson={itemsJson}
                          callbackUrl={callbackUrl}
                            onLoaded={() => {
                            console.log('[GETNET] loader loaded')
                          }}
                        />

                        <p className="text-xs text-gray-500 mt-3">
                          Se o checkout não abrir, verifique bloqueadores de pop-up/terceiros.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              /*// ===== PayPal CTA (tu bloque original) =====*/
              !paypalClientId ? (
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
                          setPaymentOpen(false)
                          setPaypalKey((k) => k + 1)
                        }}
                      />
                    </div>
                  )}
                </PayPalScriptProvider>
              )
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
                .slice(0, 18)
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
function splitName(full: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: parts[0], last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function onlyDigits(s: string) {
  return (s || '').replace(/\D/g, '')
}

function GetnetLoader(props: {
  loaderUrl: string
  sellerId: string
  token: string
  amount: string
  customerId: string
  orderId: string
  fullName: string
  cpf: string
  email: string

  // address
  cep: string
  street: string
  number: string
  district: string
  city: string
  state: string
  complement?: string

  // items
  itemsJson: string

  // callback
  callbackUrl: string

  // hook opcional: avisa cuando el script cargó
  onLoaded?: () => void
}) {

  const { first, last } = splitName(props.fullName)
  const cpfDigits = onlyDigits(props.cpf)

  useEffect(() => {
    // Limpia scripts previos
    const existing = document.querySelectorAll('script[data-ziza-getnet="1"]')
    existing.forEach((el) => el.parentElement?.removeChild(el))

    const s = document.createElement('script')
    s.async = true
    s.src = props.loaderUrl
    s.setAttribute('data-ziza-getnet', '1')

    // Si el script ya estaba cacheado / o se necesita “reinit”, esto ayuda a detectar carga
    s.onload = () => {
      props.onLoaded?.()
    }

    s.onerror = () => {
      console.log('[GETNET] loader script failed to load:', props.loaderUrl)
    }

    // Token: el doc pide "token_type + space + access_token"
    const token = props.token.startsWith('Bearer ')
      ? props.token
      : `Bearer ${props.token}`

    // === Atributos base ===
    s.setAttribute('data-getnet-sellerid', props.sellerId)
    s.setAttribute('data-getnet-token', token)
    s.setAttribute('data-getnet-customerid', props.customerId)
    s.setAttribute('data-getnet-orderid', props.orderId)
    s.setAttribute('data-getnet-button-class', 'open-getnet-checkout')
    

    // (Opcional / si tu loader lo usa)
    s.setAttribute('data-getnet-amount', props.amount)
    s.setAttribute('data-getnet-installments', '1')

    // === Customer (sin cifrado) ===
    s.setAttribute('data-getnet-customer-first-name', first || '')
    s.setAttribute('data-getnet-customer-last-name', last || '')
    s.setAttribute('data-getnet-customer-email', props.email || '')

    // CPF (si viene)
    if (cpfDigits.length === 11) {
      s.setAttribute('data-getnet-customer-document-type', 'CPF')
      s.setAttribute('data-getnet-customer-document-number', cpfDigits)
    }

    // === Customer Address (MUY importante) ===
    // En la doc aparecen como customer-address-* y country (alpha2). :contentReference[oaicite:2]{index=2}
    const cepDigits = (props.cep || '').replace(/\D/g, '').slice(0, 8)

    s.setAttribute('data-getnet-customer-address-street', props.street || '')
    s.setAttribute('data-getnet-customer-address-street-number', props.number || '')
    s.setAttribute('data-getnet-customer-address-neighborhood', props.district || '')
    s.setAttribute('data-getnet-customer-address-city', props.city || '')
    s.setAttribute('data-getnet-customer-address-state', props.state || '')
    s.setAttribute('data-getnet-customer-address-zipcode', cepDigits)
    s.setAttribute('data-getnet-customer-country', 'BR') // alpha-2

    // === Shipping Address (en tu consola te sale null porque NO lo estabas seteando) ===
    // OJO: el ejemplo de la doc usa un ARRAY. :contentReference[oaicite:3]{index=3}
    const shippingAddressJson = JSON.stringify([
      {
        first_name: first || '',
        name: `${first || ''} ${last || ''}`.trim(),
        email: props.email || '',
        phone_number: '',
        shipping_amount: 0,
        address: {
          street: props.street || '',
          number: props.number || '',
          complement: props.complement || '',
          district: props.district || '',
          city: props.city || '',
          state: props.state || '',
          country: 'Brasil',
          postal_code: cepDigits,
        },
      },
    ])

    s.setAttribute('data-getnet-shipping-address', shippingAddressJson)

    // === items ===
    // En tu CheckoutPage ya armas itemsJson correcto (array JSON en string).
    s.setAttribute('data-getnet-items', props.itemsJson || '[]')

    // Callback (recomendado)
    if (props.callbackUrl) {
      s.setAttribute('data-getnet-url-callback', props.callbackUrl)
    }

    document.body.appendChild(s)

    return () => {
      try { s.parentElement?.removeChild(s) } catch {}
    }
  }, [
    props.loaderUrl,
    props.sellerId,
    props.token,
    props.amount,
    props.customerId,
    props.orderId,
    props.fullName,
    props.cpf,
    props.email,
    props.callbackUrl,
    props.itemsJson,
  ])
  return null
}