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
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, email')
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'order_not_found' }, { status: 404 })
  }

  const finalEmail = (newEmailRaw || order.email || '').trim()
  if (!finalEmail) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  // Si viene email nuevo, lo guardamos en la orden
  if (newEmailRaw && newEmailRaw.trim() !== order.email) {
    await supabase.from('orders').update({ email: finalEmail }).eq('id', orderId)
  }

  // Enviar correo
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const siteUrl = process.env.SITE_URL || 'https://zizaphotography.com.br'
  const from = process.env.EMAIL_FROM || 'Ziza Fotos <onboarding@resend.dev>'

  await resend.emails.send({
    from,
    to: finalEmail,
    subject: 'Pagamento confirmado — Suas fotos estão prontas',
    html: renderOrderEmail({ siteUrl, orderId }),
  })

  // Deja registro consistente
  await supabase.from('orders').update({ email_sent: true }).eq('id', orderId)

  return NextResponse.json({ ok: true, orderId, email: finalEmail })
}
