import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderNumber = searchParams.get('orderNumber');

    if (!orderNumber) {
      return NextResponse.json(
        { error: '주문 번호가 누락되었습니다.' },
        { status: 400 }
      );
    }

    console.log('주문 파일 다운로드 프록시 요청:', orderNumber);

    // 백엔드 API 호출
    const backendUrl = `${BACKEND_URL}/api/download-order-files/${encodeURIComponent(orderNumber)}`;

    const response = await fetch(backendUrl, {
      method: 'GET',
    });

    // 응답이 JSON 에러인 경우
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || '파일 다운로드 실패' },
        { status: response.status }
      );
    }

    // ZIP 파일 스트리밍
    const blob = await response.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${orderNumber}.zip"`,
      },
    });

  } catch (error) {
    console.error('파일 다운로드 프록시 에러:', error);
    return NextResponse.json(
      {
        error: '파일 다운로드에 실패했습니다.',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
