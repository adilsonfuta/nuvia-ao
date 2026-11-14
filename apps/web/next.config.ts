import type { NextConfig } from 'next';

const apiServer = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiServer}/:path*` }];
  },
};
export default nextConfig;
