import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = searchParams.get('order')
    if (!orderId) return NextResponse.json({ error: 'missing_order' }, { status: 400 })

    const supabaseUrl = process.env.SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'missing_supabase_env' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: order, error } = await supabase
      .from('orders')
      .select('id, selected_images')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'order_not_found', detail: error?.message }, { status: 404 })
    }

    const paths: string[] = (order.selected_images || []).filter(Boolean)
    if (paths.length === 0) {
      return NextResponse.json({ error: 'no_images' }, { status: 400 })
    }

    const bucket = 'event-photos'
    const { data, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 30) // 30 min

    if (signErr || !data) {
      return NextResponse.json({ error: 'sign_failed', detail: signErr?.message }, { status: 500 })
    }

    const urls = data.map((x) => x.signedUrl).filter(Boolean)
    return NextResponse.json({ urls })
  } catch (e: any) {
    return NextResponse.json({ error: 'unexpected', detail: String(e?.message || e) }, { status: 500 })
  }
}
