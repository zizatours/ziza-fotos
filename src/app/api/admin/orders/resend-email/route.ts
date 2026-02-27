import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { renderOrderEmail } from '@/lib/orderEmail'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // (Opcional) Protección simple con una key
  // Si defines ADMIN_API_KEY en Vercel, exigimos header x-admin-key
  const adminKey = process.env.ADMIN_API_KEY
  if (adminKey) {
    const got = req.headers.get('x-admin-key')
    if (!got || got !== adminKey) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({} as any))
  const orderId = String(body?.orderId || '')
  const newEmailRaw = body?.email ? String(body.email) : null

  if (!orderId) {
    return NextResponse.json({ error: 'missing_orderId' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Buscar orden
  // Buscar orden (soporta order.id normal o getnet_pending_orders.order_id)
  let resolvedOrderId = orderId
  let order: { id: string; email: string | null } | null = null
  let pendingGetnetOrder: { order_id: string; app_order_id: string | null; email: string | null } | null = null

  // 1) Intentar como order.id normal
  {
    const { data, error } = await supabase
      .from('orders')
      .select('id, email')
      .eq('id', orderId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'order_lookup_failed' }, { status: 500 })
    }

    if (data) {
      order = data
    }
  }

  // 2) Si no existe, intentar resolver como getnet_pending_orders.order_id
  if (!order) {
    const { data: pending, error: pendingErr } = await supabase
      .from('getnet_pending_orders')
      .select('order_id, app_order_id, email')
      .eq('order_id', orderId)
      .maybeSingle()

    if (pendingErr) {
      return NextResponse.json({ error: 'getnet_pending_lookup_failed' }, { status: 500 })
    }

    if (!pending) {
      return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
    }

    pendingGetnetOrder = pending

    if (!pending.app_order_id) {
      return NextResponse.json(
        { error: 'getnet_order_not_fulfilled_yet' },
        { status: 409 }
      )
    }

    resolvedOrderId = String(pending.app_order_id)

    const { data: resolvedOrder, error: resolvedOrderErr } = await supabase
      .from('orders')
      .select('id, email')
      .eq('id', resolvedOrderId)
      .maybeSingle()

    if (resolvedOrderErr) {
      return NextResponse.json({ error: 'resolved_order_lookup_failed' }, { status: 500 })
    }

    if (!resolvedOrder) {
      return NextResponse.json({ error: 'resolved_order_not_found' }, { status: 404 })
    }

    order = resolvedOrder
  }

  const finalEmail = (newEmailRaw || order.email || pendingGetnetOrder?.email || '').trim()
  if (!finalEmail) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  // Si viene email nuevo, lo guardamos en la orden
  if (newEmailRaw && newEmailRaw.trim() !== order.email) {
    await supabase.from('orders').update({ email: finalEmail }).eq('id', resolvedOrderId)

    // Si el admin pegó un order_id de Getnet, mantenemos también la pre-orden consistente
    if (pendingGetnetOrder) {
      await supabase
        .from('getnet_pending_orders')
        .update({ email: finalEmail })
        .eq('order_id', pendingGetnetOrder.order_id)
    }
  }

  // Enviar correo
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const siteUrl = process.env.SITE_URL || 'https://zizaphotography.com.br'
  const from = process.env.EMAIL_FROM || 'Ziza Fotos <onboarding@resend.dev>'

  await resend.emails.send({
    from,
    to: finalEmail,
    subject: 'Pagamento confirmado — Suas fotos estão prontas',
    html: renderOrderEmail({ siteUrl, orderId: resolvedOrderId }),
  })

  // Deja registro consistente
  await supabase.from('orders').update({ email_sent: true }).eq('id', resolvedOrderId)

  return NextResponse.json({
    ok: true,
    orderId: resolvedOrderId,
    inputOrderId: orderId,
    email: finalEmail,
  })
}
