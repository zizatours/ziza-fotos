import { createClient } from '@supabase/supabase-js'
import archiver from 'archiver'
import path from 'path'
import { PassThrough, Readable } from 'stream'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('order') || ''

  if (!orderId) return new Response('Missing order', { status: 400 })

  const supabaseUrl = process.env.SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 1) Leer orden (tu schema usa selected_images)
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, selected_images')
    .eq('id', orderId)
    .single()

  if (error || !order) return new Response('Order not found', { status: 404 })

  const paths: string[] = (order.selected_images || []).filter(Boolean)
  if (paths.length === 0) return new Response('No images', { status: 400 })

  // 2) Signed URLs (30 min)
  const bucket = 'event-photos'
  const { data: signed, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, 60 * 30)

  if (signErr || !signed) return new Response('Sign failed', { status: 500 })

  // 3) Crear ZIP streaming
  const archive = archiver('zip', { zlib: { level: 9 } })
  const passthrough = new PassThrough()

  archive.on('error', (err) => {
    console.log('ZIP error:', err)
    passthrough.destroy(err)
  })

  archive.pipe(passthrough)

  // 4) Agregar archivos al zip (stream desde fetch)
  for (let i = 0; i < signed.length; i++) {
    const s = signed[i]
    if (!s?.signedUrl) continue

    const res = await fetch(s.signedUrl)
    if (!res.ok || !res.body) continue

    const filePath = paths[i] || `photo_${i + 1}.jpg`
    const base = path.basename(filePath).replace(/[^\w.\-]/g, '_')
    const filename = `${String(i + 1).padStart(3, '0')}_${base}`

    const nodeStream = Readable.fromWeb(res.body as any)
    archive.append(nodeStream, { name: filename })
  }

  archive.finalize()

  // Response necesita web stream
  const webStream = Readable.toWeb(passthrough as any) as any

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="ziza_order_${orderId}.zip"`,
      'Cache-Control': 'no-store',
    },
  })
}
