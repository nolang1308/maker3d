import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '키보드 클리커 만들기',
  description: '사진을 키캡 위에 올려 나만의 키보드 클리커를 꾸미고 3D로 미리 확인해 보세요.',
  alternates: {
    canonical: '/cliker',
  },
  // 체험용 페이지라 정식 공개 전까지는 검색에 노출하지 않는다
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: '키보드 클리커 만들기 | MAKER3D',
    description: '사진을 키캡 위에 올려 나만의 키보드 클리커를 꾸미고 3D로 미리 확인해 보세요.',
    url: '/cliker',
  },
};

export default function ClickerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
