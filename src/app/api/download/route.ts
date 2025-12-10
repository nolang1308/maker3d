import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d-attachments';
const bucket = storage.bucket(bucketName);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const fileName = searchParams.get('name');

    if (!filePath) {
      return NextResponse.json(
        { error: '파일 경로가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // GCS에서 파일 가져오기
    const file = bucket.file(filePath);

    // 파일 존재 여부 확인
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 파일 메타데이터 가져오기
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    const originalName = metadata.metadata?.originalName || fileName || 'download';

    // 파일 스트림 생성
    const stream = file.createReadStream();
    
    // ReadableStream으로 변환
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        
        stream.on('end', () => {
          controller.close();
        });
        
        stream.on('error', (error) => {
          console.error('파일 스트림 에러:', error);
          controller.error(error);
        });
      }
    });

    // 다운로드 응답 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    headers.set('Cache-Control', 'public, max-age=31536000'); // 1년 캐시
    
    if (metadata.size) {
      headers.set('Content-Length', metadata.size.toString());
    }

    return new NextResponse(readableStream, {
      status: 200,
      headers: headers
    });

  } catch (error) {
    console.error('파일 다운로드 API 에러:', error);
    return NextResponse.json(
      { error: '파일 다운로드에 실패했습니다.' },
      { status: 500 }
    );
  }
}