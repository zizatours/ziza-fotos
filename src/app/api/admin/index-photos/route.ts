import { NextResponse } from 'next/server'
import {
  RekognitionClient,
  IndexFacesCommand,
} from '@aws-sdk/client-rekognition'
import { createClient } from '@supabase/supabase-js'

const rekognition = new RekognitionClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { event_slug, imageUrls } = await req.json()

    if (!event_slug || !imageUrls || !Array.isArray(imageUrls)) {
      return NextResponse.json(
        { error: 'Missing event_slug or imageUrls' },
        { status: 400 }
      )
    }

    let indexed = 0

    for (const imageUrl of imageUrls) {
      const key = imageUrl.split('/').pop()
      if (!key) continue

      const command = new IndexFacesCommand({
        CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
        Image: {
          S3Object: {
            Bucket: process.env.AWS_S3_BUCKET!,
            Name: `${event_slug}/${key}`,
          },
        },
        DetectionAttributes: [],
      })

      const response = await rekognition.send(command)

      if (!response.FaceRecords || response.FaceRecords.length === 0) continue

      for (const record of response.FaceRecords) {
        if (!record.Face?.FaceId || !record.Face.BoundingBox) continue

        const { error } = await supabase.from('event_faces').insert({
          event_slug,
          image_url: imageUrl,
          face_id: record.Face.FaceId,
          bounding_box: record.Face.BoundingBox,
        })

        if (error) {
          console.error('SUPABASE INSERT ERROR:', error)
          return NextResponse.json(
            { error: 'Failed to insert face' },
            { status: 500 }
          )
        }

        indexed++
      }
    }

    return NextResponse.json({
      success: true,
      indexed,
    })
  } catch (err) {
    console.error('INDEX PHOTOS ERROR:', err)
    return NextResponse.json(
      { error: 'Indexing failed' },
      { status: 500 }
    )
  }
}
