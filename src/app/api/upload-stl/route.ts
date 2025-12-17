import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // FormData 받기
    const formData = await request.formData();

    // 백엔드 서버 URL (환경 변수 또는 기본값)
    const BACKEND_URL = process.env.BACKEND_URL || 'http://14.5.102.253:10000';

    console.log('프록시: STL 파일을 백엔드로 전달 중...', BACKEND_URL);

    // 백엔드 서버로 FormData 전달
    const response = await fetch(`${BACKEND_URL}/api/upload-stl`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    console.log('백엔드 응답:', data);

    // 백엔드 응답을 그대로 프론트엔드에 전달
    return NextResponse.json(data, { status: response.status });

  } catch (error) {
    console.error('프록시 에러:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'STL 파일 업로드 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
