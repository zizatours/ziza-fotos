import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GETNET está llamando por GET con query params (confirmado en logs)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const params = Object.fromEntries(url.searchParams.entries())

    console.log('[GETNET WEBHOOK][GET] params:', params)

    const orderId = (params.order_id || '').trim()
    const status = (params.status || '').trim().toUpperCase()
    const paymentType = (params.payment_type || '').trim().toLowerCase()
    const paymentId = (params.payment_id || '').trim()
    const transactionId = (params.transaction_id || '').trim()

    const amountRaw = (params.amount || '').trim()
    const amountCentsReported = /^\d+$/.test(amountRaw) ? Number(amountRaw) : null

    if (!orderId) {
      console.warn('[GETNET WEBHOOK][GET] missing order_id')
      return NextResponse.json({ ok: true, ignored: 'missing_order_id' })
    }

    const patch: Record<string, any> = {
      callback_status: status || null,
      payment_type: paymentType || null,
      getnet_payment_id: paymentId || null,
      getnet_transaction_id: transactionId || null,
      amount_cents_reported: amountCentsReported,
      callback_payload: params,
      updated_at: new Date().toISOString(),
    }

    if (status === 'APPROVED') {
      patch.status = 'approved'
      patch.approved_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('getnet_pending_orders')
      .update(patch)
      .eq('order_id', orderId)
      .select('order_id,status,email,event_slug')
      .maybeSingle()

    if (error) {
      console.error('[GETNET WEBHOOK][GET] update error:', error)
      return NextResponse.json({ ok: false }, { status: 200 })
    }

    if (!data) {
      console.warn('[GETNET WEBHOOK][GET] order_id not found in pending table:', orderId)
      return NextResponse.json({ ok: true, warning: 'order_not_found' })
    }

    console.log('[GETNET WEBHOOK][GET] updated pending order:', data)

    return NextResponse.json({ ok: true, updated: true, order_id: orderId, status })
  } catch (err) {
    console.error('[GETNET WEBHOOK][GET] error:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

// Mantén POST por compatibilidad (por si Getnet cambia el método)
export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    let parsedBody: unknown = null
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null
    } catch {
      parsedBody = null
    }

    const headersObj = Object.fromEntries(req.headers.entries())

    console.log('[GETNET WEBHOOK][POST] headers:', headersObj)
    console.log('[GETNET WEBHOOK][POST] rawBody:', rawBody)
    console.log('[GETNET WEBHOOK][POST] parsedBody:', parsedBody)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[GETNET WEBHOOK][POST] error:', err)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}