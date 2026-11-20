const apiServer = (process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // Public event albums accept up to ten 8 MB photos in one multipart
    // request. Next's default 10 MB body clone truncates the rewritten request.
    middlewareClientMaxBodySize: '85mb',
  },
  async headers() {
    const production = process.env.NODE_ENV === 'production';
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' https://www.clarity.ms https://*.clarity.ms https://www.googletagmanager.com${production ? '' : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.clarity.ms https://c.bing.com https://www.googletagmanager.com https://*.google-analytics.com https://*.google.com",
      "frame-src https://www.openstreetmap.org",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(production ? ['upgrade-insecure-requests'] : []),
    ].join('; ');

    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ...(production ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
      ],
    }];
  },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiServer}/:path*` }];
  },
};
export default nextConfig;
