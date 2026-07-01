/**
 * Configuration Firebase — les valeurs viennent des variables
 * d'environnement Next.js (NEXT_PUBLIC_*) pour ne pas exposer
 * les clés en clair dans le dépôt Git. La clé API Firebase est
 * "publique" par nature (elle identifie le projet, pas un secret),
 * mais la convention Next.js conseille quand même de la sortir du
 * code source pour éviter de la retrouver dans l'historique Git
 * et pour faciliter la rotation si besoin.
 *
 * Valeurs à ajouter dans .env.local (dev) et dans les variables
 * d'environnement Vercel (prod) :
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDnS_PZtJzspRoyS9a9k0HEVBq6iAWIN8c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "plume-f3424.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "plume-f3424",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "plume-f3424.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "612131621608",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:612131621608:web:ac6001f00f205e9c59975d",
  measurementId: "G-RFWCQ9QK6R"
};
