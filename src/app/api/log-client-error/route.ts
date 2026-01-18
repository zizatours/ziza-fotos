import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  console.log('CLIENT_ERROR:', body)
  return NextResponse.json({ ok: true })
}
