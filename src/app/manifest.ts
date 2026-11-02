
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LISORIA - Journal de Lecture',
    short_name: 'Lisoria',
    description: 'Votre réserve littéraire précieuse et authentique.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F1E8',
    theme_color: '#1B2430',
    icons: [
      {
        src: '/icon-192-v4.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512-v4.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
