import { RekognitionClient, ListCollectionsCommand } from '@aws-sdk/client-rekognition'

const client = new RekognitionClient({
  region: 'us-east-1', // usa la misma región
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function run() {
  const result = await client.send(new ListCollectionsCommand({}))
  console.log('Collections:', result.CollectionIds)
}

run()
