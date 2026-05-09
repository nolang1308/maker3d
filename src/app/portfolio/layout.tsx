import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '포트폴리오',
  description: 'MAKER3D의 3D 프린팅 제작 사례를 확인하세요. 다양한 소재와 복잡한 형상의 출력 결과물을 포트폴리오에서 만나보실 수 있습니다.',
  alternates: {
    canonical: '/portfolio',
  },
  openGraph: {
    title: '포트폴리오 | MAKER3D',
    description: 'MAKER3D의 3D 프린팅 제작 사례 모음. 다양한 소재와 형상의 출력 결과물을 확인하세요.',
    url: '/portfolio',
  },
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
