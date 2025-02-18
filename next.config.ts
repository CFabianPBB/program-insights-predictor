import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  poweredByHeader: false,
  generateEtags: false,
  compress: true,
  images: {
    unoptimized: true,
  },
  distDir: '.next',
  experimental: {
    serverActions: true,
  }
};

export default nextConfig;