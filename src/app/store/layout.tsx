import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '스토어',
  description: 'MAKER3D 스토어에서 3D 프린팅 관련 상품을 만나보세요. 다양한 출력 옵션과 합리적인 가격으로 제공합니다.',
  alternates: {
    canonical: '/store',
  },
  openGraph: {
    title: '스토어 | MAKER3D',
    description: 'MAKER3D 스토어 - 3D 프린팅 상품을 합리적인 가격에 만나보세요.',
    url: '/store',
  },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
