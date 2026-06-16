
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PLUME - Journal de Lecture',
    short_name: 'Plume',
    description: 'Votre réserve littéraire précieuse et authentique.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdf2f5',
    theme_color: '#d68fa3',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
