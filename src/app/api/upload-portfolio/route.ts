import { NextRequest, NextResponse } from 'next/server';

// API Route 설정
export const maxDuration = 60;
export const runtime = 'nodejs';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

// 포트폴리오 이미지 업로드 프록시
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;

    console.log('포트폴리오 이미지 업로드 요청:', {
      fileName: image?.name,
      fileSize: image?.size
    });

    if (!image) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API로 전송
    const backendFormData = new FormData();

    // File을 Blob으로 변환
    const arrayBuffer = await image.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: image.type });
    backendFormData.append('image', blob, image.name);

    console.log('백엔드로 전송:', `${BACKEND_URL}/api/upload-portfolio-image`);

    const backendResponse = await fetch(`${BACKEND_URL}/api/upload-portfolio-image`, {
      method: 'POST',
      body: backendFormData
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('백엔드 업로드 실패:', errorData);
      return NextResponse.json(
        { error: errorData.error || '이미지 업로드에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    console.log('백엔드 업로드 성공:', result);

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      fileName: result.fileName,
      originalName: result.originalName
    });

  } catch (error) {
    console.error('이미지 업로드 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { error: '이미지 업로드에 실패했습니다.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
