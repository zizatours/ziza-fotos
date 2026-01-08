import { NextRequest } from 'next/server'
import sharp, { type OverlayOptions, type Blend } from 'sharp'
import path from 'path'
import { readFile } from 'fs/promises'

export const runtime = 'nodejs' // importante: sharp necesita runtime node

let WATERMARK_CACHE: Buffer | null = null

async function getWatermarkBuffer() {
  if (WATERMARK_CACHE) return WATERMARK_CACHE
  const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png')
  WATERMARK_CACHE = await readFile(watermarkPath)
  return WATERMARK_CACHE
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const src = searchParams.get('src')

    if (!src) {
      return new Response('Missing src', { status: 400 })
    }

    // 1) Descargar imagen original
    const imgRes = await fetch(src)
    if (!imgRes.ok) {
      return new Response(`Failed to fetch src: ${imgRes.status}`, { status: 400 })
    }
    const inputArrayBuffer = await imgRes.arrayBuffer()
    const inputBuffer = Buffer.from(inputArrayBuffer)

    // 2) Leer watermark desde /public/watermark.png
    const watermarkBuffer = await getWatermarkBuffer()

    // 3) Preparar base
    const base = sharp(inputBuffer)
    const meta = await base.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0

    if (!width || !height) {
      return new Response('Invalid image', { status: 400 })
    }

    // 4) Escalar watermark relativo al tamaño de la foto
    //    Ajusta estos valores si quieres más/menos grande:
    const targetWmWidth = Math.max(220, Math.round(width * 0.28)) // ~28% del ancho
    const wm = sharp(watermarkBuffer).resize({ width: targetWmWidth, withoutEnlargement: true })
    const wmPng = await wm.png().toBuffer()
    const wmMeta = await sharp(wmPng).metadata()

    const wmW = wmMeta.width ?? 0
    const wmH = wmMeta.height ?? 0
    if (!wmW || !wmH) {
      return new Response('Invalid watermark', { status: 500 })
    }

    // Si por algún motivo el watermark queda más grande que la foto, lo achicamos
    let finalWm = wmPng
    let finalW = wmW
    let finalH = wmH

    if (finalW > width || finalH > height) {
      const fitWidth = Math.round(width * 0.8)
      const resized = await sharp(wmPng).resize({ width: fitWidth, withoutEnlargement: true }).png().toBuffer()
      const rMeta = await sharp(resized).metadata()
      finalWm = resized
      finalW = rMeta.width ?? finalW
      finalH = rMeta.height ?? finalH
    }

    // 5) Generar tiles SIN salirse de la imagen (esto evita el 500 de sharp)
    //    Gap controla distancia entre marcas para que no se “pisen”
    const gapX = Math.round(finalW * 0.65)
    const gapY = Math.round(finalH * 0.65)

    const stepX = finalW + gapX
    const stepY = finalH + gapY

    const overlays: OverlayOptions[] = []

    let row = 0
    for (let top = 0; top + finalH <= height; top += stepY) {
      const rowOffset = row % 2 === 0 ? 0 : Math.round(stepX / 2)

      for (let left = -rowOffset; left + finalW <= width; left += stepX) {
        const safeLeft = Math.max(0, left) // nunca negativo
        if (safeLeft + finalW > width) continue

        overlays.push({
          input: finalWm,
          left: safeLeft,
          top,
          blend: 'over' as Blend,
        })
      }

      row++
    }

    // 6) Componer
    const output = await base
      .composite(overlays)
      .jpeg({ quality: 85 })
      .toBuffer()

    // 7) Responder (IMPORTANTE: usar Uint8Array para evitar error TS Buffer vs BodyInit)
    return new Response(new Uint8Array(output), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err: any) {
    console.error('Preview error:', err)
    return new Response(`Preview error: ${err?.message ?? 'Unknown error'}`, { status: 500 })
  }
}
