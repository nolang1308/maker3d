import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['shop-phinf.pstatic.net', 'dthumb-phinf.pstatic.net', 'localhost', '14.5.102.253'],
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.pstatic.net',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '14.5.102.253',
      },
    ],
  },
  // Google Cloud Storage external package 설정
  serverExternalPackages: ['@google-cloud/storage'],
};

export default nextConfig;
