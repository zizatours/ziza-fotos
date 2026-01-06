import { NextResponse } from 'next/server'
import { RekognitionClient, IndexFacesCommand } from '@aws-sdk/client-rekognition'
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
    const { imageUrl, eventSlug } = await req.json()

    if (!imageUrl || !eventSlug) {
      return NextResponse.json(
        { error: 'Missing imageUrl or eventSlug' },
        { status: 400 }
      )
    }

    const command = new IndexFacesCommand({
      CollectionId: process.env.AWS_REKOGNITION_COLLECTION_ID!,
      Image: {
        S3Object: {
          Bucket: process.env.AWS_S3_BUCKET!,
          Name: imageUrl.split('/').pop()!,
        },
      },
      DetectionAttributes: [],
    })

    const response = await rekognition.send(command)

    if (!response.FaceRecords || response.FaceRecords.length === 0) {
      return NextResponse.json(
        { error: 'No face detected in image' },
        { status: 200 }
      )
    }

    const faceRecord = response.FaceRecords[0]

    if (!faceRecord.Face || !faceRecord.Face.FaceId) {
      return NextResponse.json(
        { error: 'Face data missing' },
        { status: 500 }
      )
    }

    const face = faceRecord.Face

    const { error } = await supabase.from('event_faces').insert({
      event_slug: eventSlug,
      image_url: imageUrl,
      face_id: face.FaceId,
      bounding_box: face.BoundingBox,
    })

    if (error) {
      console.error('SUPABASE INSERT ERROR:', error)
      return NextResponse.json(
        { error: 'Failed to save face data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      faceId: face.FaceId,
    })
  } catch (err) {
    console.error('INDEX FACE ERROR:', err)
    return NextResponse.json(
      { error: 'Indexing failed' },
      { status: 500 }
    )
  }
}
