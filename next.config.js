const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true
  },
  distDir: '.next',
  images: {
    unoptimized: true
  },
  // Make sure static files are exported properly
  assetPrefix: process.env.NODE_ENV === 'production' ? '/_next' : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NODE_ENV === 'production' ? '/_next' : ''
  }
};

module.exports = nextConfig;