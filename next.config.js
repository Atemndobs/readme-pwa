/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'localhost:3007'],
    },
    instrumentationHook: true, // Enable instrumentation hook
  },
  headers: async () => {
    return [
      {
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
}

const sentryWebpackPluginOptions = {
  org: "bertrand-atemkeng",
  project: "javascript-nextjs",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: false,
  hideSourceMaps: true,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring-tunnel",
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
