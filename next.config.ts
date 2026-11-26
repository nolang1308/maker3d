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
  // 2026-11-26 에 두 만들기 페이지의 주소 철자를 바로잡았다 (cliker → clicker).
  // 옛 주소로 들어오는 링크(공유한 주소, 광고 링크)는 새 주소로 넘긴다. 주소 뒤의 값(?utm_... 등)은 그대로 따라간다.
  async redirects() {
    return [
      { source: '/cliker', destination: '/clicker', permanent: false },
      { source: '/shapecliker', destination: '/shapeclicker', permanent: false },
    ];
  },
};

export default nextConfig;
