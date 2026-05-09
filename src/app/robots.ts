import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://maker3d.co.kr').replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/mypage/',
          '/cart/',
          '/payment/',
          '/api/',
          '/find-account/',
          '/register/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
