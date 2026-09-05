import type { NextConfig } from 'next';
import path from 'path';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Turbopack in dev needs 'unsafe-eval'; production does not.
 * Firestore talks over both XHR and WebSocket, so both schemes are allowed in connect-src.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseapp.com https://vercel.live${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.googleusercontent.com https://vercel.live https://vercel.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://vercel.live",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://apis.google.com https://vercel.live",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
