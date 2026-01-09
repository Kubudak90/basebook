/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  // Turbopack configuration for Next.js 16
  experimental: {
    turbo: {
      resolveAlias: {
        // Fix for MetaMask SDK trying to resolve react-native modules
        '@react-native-async-storage/async-storage': './lib/utils/mock.ts',
        'pino-pretty': './lib/utils/mock.ts',
      },
    },
  },
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig
