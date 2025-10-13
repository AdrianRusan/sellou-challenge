/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  outputFileTracingRoot: __dirname,
  webpack: (config, { isServer }) => {
    // Exclude supabase functions from webpack bundling
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/functions/**', '**/node_modules/**'],
    }
    return config
  },
}

module.exports = nextConfig
