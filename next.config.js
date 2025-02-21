const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true
  },
  distDir: '.next',
  images: {
    unoptimized: true
  }
  // Remove the assetPrefix and env configurations
};

module.exports = nextConfig;