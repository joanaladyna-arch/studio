
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // firebase-admin/auth tire jwks-rsa -> jose, un paquet ESM pur. Sans
  // cette liste, Webpack empaquette quand même ce sous-module (même
  // chargé via un import() dynamique côté route) et le convertit en
  // require() au runtime Node de Vercel, qui échoue avec ERR_REQUIRE_ESM.
  // En listant ces paquets ici, Next.js les laisse en dehors du bundle et
  // les charge nativement via le vrai système de modules de Node.
  serverExternalPackages: ["firebase-admin", "jose", "jwks-rsa"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
