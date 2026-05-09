import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '공지사항',
  description: 'MAKER3D 공지사항 - 서비스 업데이트, 이벤트, 운영 안내 등 최신 소식을 확인하세요.',
  alternates: {
    canonical: '/notice',
  },
  openGraph: {
    title: '공지사항 | MAKER3D',
    description: 'MAKER3D 최신 공지사항을 확인하세요.',
    url: '/notice',
  },
};

export default function NoticeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
