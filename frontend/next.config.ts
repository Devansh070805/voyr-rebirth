import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Don't include trailing slashes
  skipTrailingSlashRedirect: true,

  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
