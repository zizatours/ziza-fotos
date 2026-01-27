import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const BUCKET = 'event-photos'

export async function POST(req: Request) {
  try {
    const { path } = await req.json()

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'missing_path' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .createSignedUploadUrl(path)

    if (error || !data) {
      return NextResponse.json({ error: 'signed_upload_failed', details: error?.message }, { status: 500 })
    }

    // data: { signedUrl, path, token }
    return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path: data.path })
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', details: e?.message }, { status: 500 })
  }
}
