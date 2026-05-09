import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '고객 문의',
  description: '3D 프린팅 관련 문의사항을 남겨주세요. MAKER3D 고객센터가 빠르게 답변드립니다. Tel: 054-462-4140 / 평일 08:30 ~ 19:00.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: '고객 문의 | MAKER3D',
    description: '3D 프린팅 문의는 MAKER3D로. 평일 08:30~19:00 상담 가능.',
    url: '/contact',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
