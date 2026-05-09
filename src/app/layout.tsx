import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { AuthProvider } from "../contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pretendard = localFont({
  src: [
    {
      path: "../fonts/Pretendard-Thin.ttf",
      weight: "100",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-ExtraLight.ttf",
      weight: "200",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-ExtraBold.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "../fonts/Pretendard-Black.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://maker3d.co.kr';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MAKER3D | 3D 프린팅 전문 서비스',
    template: '%s | MAKER3D',
  },
  description: '고품질 3D 프린팅 전문 서비스 MAKER3D. PLA·ABS·PETG·TPU·광경화성 레진 출력, 빠른 출하, 합리적인 가격으로 당신의 아이디어를 현실로 만들어 드립니다.',
  keywords: ['3D 프린팅', '3D 프린터', '3D 출력', 'PLA', 'ABS', 'PETG', 'TPU', '광경화성 레진', '레진 출력', '시제품 제작', '소량생산', '구미 3D 프린팅', '경북 3D 프린팅', 'MAKER3D', '비트텍', '메이커3D'],
  authors: [{ name: '(주)비트텍' }],
  creator: '(주)비트텍',
  publisher: '(주)비트텍',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: 'MAKER3D',
    title: 'MAKER3D | 3D 프린팅 전문 서비스',
    description: '고품질 3D 프린팅 전문 서비스 MAKER3D. PLA·ABS·PETG·TPU·광경화성 레진 출력, 빠른 출하, 합리적인 가격.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MAKER3D 3D 프린팅 전문 서비스',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAKER3D | 3D 프린팅 전문 서비스',
    description: '고품질 3D 프린팅 전문 서비스 MAKER3D.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'MAKER3D',
    alternateName: '(주)비트텍',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    image: `${SITE_URL}/og-image.png`,
    description: '고품질 3D 프린팅 전문 서비스. PLA·ABS·PETG·TPU·광경화성 레진 출력.',
    telephone: '054-462-4140',
    email: '3dstore@bittech3d.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '수출대로 152 세원테크노밸리 301호',
      addressLocality: '구미시',
      addressRegion: '경상북도',
      addressCountry: 'KR',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:30',
      closes: '19:00',
    },
    sameAs: [`https://talk.naver.com/ct/w4e4gt`],
  };

  return (
    <html lang="ko">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${pretendard.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Header />
            <main style={{ flex: 1, paddingTop: '75px', backgroundColor: "white" }}>
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
