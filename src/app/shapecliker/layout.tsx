import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '쉐이프 클리커 만들기',
  description: '로고 그림을 올리면 그 모양 그대로의 키보드 클리커를 만들어 3D로 미리 보여 드립니다.',
  alternates: {
    canonical: '/shapecliker',
  },
  // 체험용 페이지라 정식 공개 전까지는 검색에 노출하지 않는다
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: '쉐이프 클리커 만들기 | MAKER3D',
    description: '로고 그림을 올리면 그 모양 그대로의 키보드 클리커를 만들어 3D로 미리 보여 드립니다.',
    url: '/shapecliker',
  },
};

export default function ShapeClickerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
