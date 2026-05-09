import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '무료 견적 요청',
  description: 'STL 파일을 업로드하고 3D 프린팅 견적을 즉시 확인하세요. PLA·ABS·PETG·TPU·광경화성 레진 소재 선택 가능. 빠르고 정확한 견적 서비스.',
  alternates: {
    canonical: '/quote',
  },
  openGraph: {
    title: '무료 견적 요청 | MAKER3D',
    description: 'STL 파일 업로드 후 즉시 3D 프린팅 견적 확인. 다양한 소재와 색상 선택 가능.',
    url: '/quote',
  },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
