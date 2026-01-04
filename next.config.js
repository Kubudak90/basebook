/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fix for MetaMask SDK trying to resolve react-native modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      }
    }
    
    // Ignore these modules entirely
    config.externals = [
      ...(config.externals || []),
      '@react-native-async-storage/async-storage',
      'pino-pretty',
    ]
    
    return config
  },
  // Suppress specific warnings
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
