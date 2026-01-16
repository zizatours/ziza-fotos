import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderOrderEmail } from '@/lib/orderEmail'

export const runtime = 'nodejs'

async function getPayPalAccessToken() {
  const base = process.env.PAYPAL_BASE_URL!
  const clientId = process.env.PAYPAL_CLIENT_ID!
  const secret = process.env.PAYPAL_CLIENT_SECRET!

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json().catch(() => ({} as any))
  if (!res.ok || !data?.access_token) throw new Error(`paypal_token_failed: ${data?.error || res.status}`)
  return data.access_token as string
}

async function verifyPayPalWebhookSignature(rawBody: string, headers: Headers) {
  const base = process.env.PAYPAL_BASE_URL!
  const webhookId = process.env.PAYPAL_WEBHOOK_ID!
  const token = await getPayPalAccessToken()

  const transmissionId = headers.get('paypal-transmission-id')
  const transmissionTime = headers.get('paypal-transmission-time')
  const certUrl = headers.get('paypal-cert-url')
  const authAlgo = headers.get('paypal-auth-algo')
  const transmissionSig = headers.get('paypal-transmission-sig')

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    throw new Error('missing_paypal_headers')
  }

  const body = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  }

  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const out = await res.json().catch(() => ({} as any))
  if (!res.ok) throw new Error(`verify_failed: ${out?.name || out?.message || res.status}`)
  return out?.verification_status === 'SUCCESS'
}

function extractOrderIdFromCaptureEvent(event: any) {
  // A veces viene aquí:
  const a = event?.resource?.supplementary_data?.related_ids?.order_id
  if (a) return a

  // O viene como link rel="up" hacia /v2/checkout/orders/{id}
  const up = (event?.resource?.links || []).find((l: any) => l?.rel === 'up')?.href
  if (up) {
    const parts = String(up).split('/')
    return parts[parts.length - 1] || null
  }

  return null
}

export async function POST(req: Request) {
  const rawBody = await req.text()

  // 1) Verificar firma (seguridad)
  try {
    const ok = await verifyPayPalWebhookSignature(rawBody, req.headers)
    if (!ok) return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  } catch (e: any) {
    console.log('WEBHOOK VERIFY ERROR:', e?.message || e)
    return NextResponse.json({ error: 'verify_error' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)

  // 2) Solo nos interesa el pago completado
  if (event?.event_type !== 'PAYMENT.CAPTURE.COMPLETED') {
    return NextResponse.json({ ok: true })
  }

  const orderId = extractOrderIdFromCaptureEvent(event)
  const captureId = event?.resource?.id

  if (!orderId) {
    console.log('WEBHOOK: missing orderId in event')
    return NextResponse.json({ ok: true })
  }

  // 3) Buscar orden por paypal_order_id y marcar pagada + enviar email (si falta)
  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, email, email_sent')
    .eq('paypal_order_id', orderId)
    .single()

  if (error || !order) {
    // Si no existe, no podemos adivinar email/fotos; esto igual evita que falle el webhook
    console.log('WEBHOOK: order not found for paypal_order_id', orderId)
    return NextResponse.json({ ok: true })
  }

  await supabase
    .from('orders')
    .update({ status: 'paid', paypal_capture_id: captureId })
    .eq('id', order.id)

  if (!order.email_sent) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY!)
      const siteUrl = process.env.SITE_URL || 'https://zizaphotography.com.br'
      const from = process.env.EMAIL_FROM || 'Ziza Fotos <onboarding@resend.dev>'

      await resend.emails.send({
        from,
        to: order.email,
        subject: 'Tus fotos están listas — Ziza Fotos',
        html: renderOrderEmail({ siteUrl, orderId: order.id }),
      })

      await supabase.from('orders').update({ email_sent: true }).eq('id', order.id)
    } catch (e) {
      console.log('WEBHOOK EMAIL ERROR:', e)
    }
  }

  return NextResponse.json({ ok: true })
}
