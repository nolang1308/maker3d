import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d-attachments';
const bucket = storage.bucket(bucketName);

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noticeId = searchParams.get('noticeId');

    if (!noticeId) {
      return NextResponse.json(
        { error: '공지사항 ID가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 해당 공지사항 폴더의 모든 파일 조회
    const [files] = await bucket.getFiles({
      prefix: `notices/${noticeId}/`
    });
    
    // 모든 파일 삭제
    const deletePromises = files.map(file => file.delete());
    await Promise.all(deletePromises);

    return NextResponse.json({ 
      success: true,
      deletedCount: files.length 
    });

  } catch (error) {
    console.error('폴더 삭제 API 에러:', error);
    return NextResponse.json(
      { error: '폴더 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}