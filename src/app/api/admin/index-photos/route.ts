import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  RekognitionClient,
  DetectFacesCommand,
} from '@aws-sdk/client-rekognition'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST() {
  try {
    // 1) Listar fotos del evento
    const { data: files, error } = await supabase.storage
      .from('event-photos')
      .list('evento-demo')

    if (error || !files) {
      return NextResponse.json({ error: 'No files found' }, { status: 500 })
    }

    let indexed = 0

    for (const file of files) {
      if (!file.name.match(/\.(jpg|jpeg|png)$/i)) continue

      const publicUrl = supabase.storage
        .from('event-photos')
        .getPublicUrl(`evento-demo/${file.name}`).data.publicUrl

      // 2) Descargar imagen
      const res = await fetch(publicUrl)
      const buffer = Buffer.from(await res.arrayBuffer())

      // 3) Detectar caras
      const command = new DetectFacesCommand({
        Image: { Bytes: buffer },
      })

      const result = await rekognition.send(command)

      if (!result.FaceDetails) continue

      // 4) Guardar caras
      for (const face of result.FaceDetails) {
        await supabase.from('event_faces').insert({
          event_slug: 'evento-demo',
          image_url: publicUrl,
          bounding_box: face.BoundingBox,
          confidence: face.Confidence,
        })
      }

      indexed++
    }

    return NextResponse.json({
      ok: true,
      indexedPhotos: indexed,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Indexing failed' },
      { status: 500 }
    )
  }
}
