/** @type {import('next').NextConfig} */

// All browser calls go to /api/... on the frontend's own domain and are forwarded to the backend.
// This keeps the login cookie first-party, so it works on Vercel + Render/Railway without CORS cookie issues.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  experimental: {
    proxyTimeout: 60000, // scans and rewrite generation can take a few seconds
  },
};

module.exports = nextConfig;
