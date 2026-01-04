/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  webpack: (config) => {
    // Fix for MetaMask SDK trying to resolve react-native modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    }
    // Ignore pino-pretty (optional dependency)
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    }
    return config
  },
}

module.exports = nextConfig
