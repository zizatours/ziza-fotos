import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

// (Opcional) GET para prueba rápida en navegador
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: 'getnet webhook',
    method: 'GET',
    message: 'Use POST for webhook notifications',
  })
}

export async function POST(req: Request) {
  try {
    // Leer body crudo una sola vez (sirve aunque no sepamos aún el formato exacto)
    const rawBody = await req.text()

    // Intento de parse JSON (si falla, lo dejamos como texto)
    let parsedBody: unknown = null
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null
    } catch {
      parsedBody = null
    }

    // Headers (útil para descubrir firma / tipo de contenido que envía Getnet)
    const headersObj = Object.fromEntries(req.headers.entries())

    // ⚠️ Temporal: logging para descubrir el payload real del webhook
    // Luego lo afinamos y quitamos datos sensibles
    console.log('[GETNET WEBHOOK] headers:', headersObj)
    console.log('[GETNET WEBHOOK] rawBody:', rawBody)
    console.log('[GETNET WEBHOOK] parsedBody:', parsedBody)

    // ✅ Responder 200 para que Getnet considere recibido (mientras estamos en fase de integración)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[GETNET WEBHOOK] error:', err)

    // A veces conviene responder 200 igual para no perder callback durante pruebas.
    // Si prefieres que Getnet reintente, puedes devolver 500.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}