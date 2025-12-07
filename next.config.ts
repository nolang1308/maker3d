import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['shop-phinf.pstatic.net', 'dthumb-phinf.pstatic.net'],
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.pstatic.net',
      },
    ],
  },
};

export default nextConfig;
