import { createClient } from '@sanity/client'

export const sanityClient = createClient({
  projectId: 't2qvzdji',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: true,
})
