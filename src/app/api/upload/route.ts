import { NextRequest, NextResponse } from 'next/server';

// API Route 설정
export const maxDuration = 60; // 60초 타임아웃
export const runtime = 'nodejs';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const noticeId = formData.get('noticeId') as string;
    const files = formData.getAll('files') as File[];

    console.log('Upload request:', { noticeId, fileCount: files.length });

    if (!noticeId) {
      return NextResponse.json(
        { error: '공지사항 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        files: [],
      });
    }

    // 파일 개수 제한 (최대 10개)
    if (files.length > 10) {
      return NextResponse.json(
        { error: '최대 10개의 파일만 업로드할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 없음

    // 백엔드 API로 파일 전송
    const backendFormData = new FormData();
    backendFormData.append('noticeId', noticeId);

    // 파일을 Blob으로 변환하여 추가
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: file.type });
      backendFormData.append('files', blob, file.name);
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/upload-notice-files`, {
      method: 'POST',
      body: backendFormData
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('백엔드 업로드 실패:', errorData);
      return NextResponse.json(
        { error: errorData.error || '파일 업로드에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    console.log('백엔드 업로드 성공:', result);

    return NextResponse.json({
      success: true,
      files: result.files,
      message: result.message
    });

  } catch (error) {
    console.error('파일 업로드 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    console.error('Error message:', (error as Error).message);
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('filePath');

    console.log('Individual file deletion request for:', filePath);

    if (!filePath) {
      console.error('Missing filePath parameter');
      return NextResponse.json(
        { error: '파일 경로가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 백엔드 API로 삭제 요청
    const backendResponse = await fetch(`${BACKEND_URL}/api/delete-notice-file?filePath=${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('백엔드 삭제 실패:', errorData);
      return NextResponse.json(
        { error: errorData.error || '파일 삭제에 실패했습니다.' },
        { status: backendResponse.status }
      );
    }

    const result = await backendResponse.json();
    console.log('백엔드 삭제 성공:', result);

    return NextResponse.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('파일 삭제 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      {
        error: '파일 삭제에 실패했습니다.',
        details: (error as Error).message
      },
      { status: 500 }
    );
  }
}
