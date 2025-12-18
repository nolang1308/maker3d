import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // FormData 받기
    const formData = await request.formData();

    const orderNumber = formData.get('orderNumber');
    const files = formData.getAll('files');

    console.log('주문 파일 업로드 요청:', {
      orderNumber,
      fileCount: files.length
    });

    // 백엔드 서버 URL
    const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:10000';
    console.log('백엔드 URL:', BACKEND_URL);

    // 백엔드 서버로 FormData 전달
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초 타임아웃

    try {
      const response = await fetch(`${BACKEND_URL}/api/upload-order-files`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('백엔드 응답 오류:', response.status, errorText);
        throw new Error(`백엔드 오류: ${response.status}`);
      }

      const data = await response.json();
      console.log('백엔드 응답 성공:', data);

      return NextResponse.json(data, { status: response.status });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error('백엔드 요청 타임아웃');
        throw new Error('파일 업로드 타임아웃 (30초 초과)');
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('주문 파일 업로드 프록시 오류:', error);
    return NextResponse.json(
      {
        success: false,
        error: '파일 업로드 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
