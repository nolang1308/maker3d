import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const runtime = 'nodejs';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';

// 자유게시판 파일 업로드 프록시
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const postId = formData.get('postId') as string;
    const files = formData.getAll('files');

    console.log('자유게시판 파일 업로드 요청:', {
      postId,
      filesCount: files.length
    });

    if (!postId) {
      return NextResponse.json(
        { error: '게시글 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        files: [],
        message: '업로드할 파일이 없습니다.'
      });
    }

    // 백엔드 API로 전송
    const backendFormData = new FormData();
    backendFormData.append('postId', postId);

    for (const file of files) {
      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: file.type });
        backendFormData.append('files', blob, file.name);
      }
    }

    console.log('백엔드로 전송:', `${BACKEND_URL}/api/upload-freenotice-files`);

    const backendResponse = await fetch(`${BACKEND_URL}/api/upload-freenotice-files`, {
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
      files: result.files
    });

  } catch (error) {
    console.error('파일 업로드 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { error: '파일 업로드에 실패했습니다.', details: (error as Error).message },
      { status: 500 }
    );
  }
}
