import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '키캡제작',
  description: 'MAKER3D 커스텀 키캡 제작 서비스. 나만의 키캡을 3D 프린팅으로 만들어보세요.',
  alternates: {
    canonical: '/makekeycap',
  },
  openGraph: {
    title: '키캡제작 | MAKER3D',
    description: 'MAKER3D 커스텀 키캡 제작 서비스.',
    url: '/makekeycap',
  },
};

export default function MakeKeycapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
