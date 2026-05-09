import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '회사 소개',
  description: 'MAKER3D는 경북 구미에 위치한 3D 프린팅 전문 기업 (주)비트텍이 운영합니다. 고품질 출력과 빠른 납기로 고객의 아이디어를 현실로 만들어드립니다.',
  alternates: {
    canonical: '/intro',
  },
  openGraph: {
    title: '회사 소개 | MAKER3D',
    description: '경북 구미 3D 프린팅 전문 기업 MAKER3D. (주)비트텍 운영.',
    url: '/intro',
  },
};

export default function IntroLayout({ children }: { children: React.ReactNode }) {
  return children;
}
