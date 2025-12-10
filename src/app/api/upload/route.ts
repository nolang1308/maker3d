import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정
let storage: Storage;
let bucket: any;

try {
  console.log('Initializing Google Cloud Storage...');
  storage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d-attachments';
  bucket = storage.bucket(bucketName);
  console.log('GCS initialized successfully');
} catch (error) {
  console.error('GCS initialization error:', error);
}

export async function POST(request: NextRequest) {
  try {
    // 환경변수 확인
    console.log('Environment variables check:', {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME
    });

    const formData = await request.formData();
    const noticeId = formData.get('noticeId') as string;
    const files = formData.getAll('files') as File[];

    console.log('Upload request:', { noticeId, fileCount: files.length });

    // GCS 버킷 연결 테스트
    try {
      console.log('Testing bucket access...');
      const [bucketExists] = await bucket.exists();
      console.log('Bucket exists:', bucketExists);
      
      if (!bucketExists) {
        return NextResponse.json(
          { error: `버킷 '${bucketName}'이 존재하지 않습니다.` },
          { status: 500 }
        );
      }
    } catch (bucketError) {
      console.error('Bucket access error:', bucketError);
      return NextResponse.json(
        { error: '스토리지 버킷에 접근할 수 없습니다.' },
        { status: 500 }
      );
    }

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

    // 파일 크기 검증 (20MB 제한)
    const MAX_SIZE = 20 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `파일 ${file.name}이 크기 제한(20MB)을 초과했습니다.` },
          { status: 400 }
        );
      }
    }

    const uploadResults = [];

    for (const file of files) {
      try {
        // 파일을 Buffer로 변환
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // 파일명에 타임스탬프와 랜덤값 추가하여 중복 방지
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const fileExtension = file.name.split('.').pop();
        const baseName = file.name.replace(/\.[^/.]+$/, ""); // 확장자 제거
        const fileName = `${timestamp}_${randomId}_${baseName}.${fileExtension}`;
        const filePath = `notices/${noticeId}/${fileName}`;
        
        // GCS 파일 객체 생성
        const gcsFile = bucket.file(filePath);
        
        // 파일 업로드
        await new Promise((resolve, reject) => {
          const stream = gcsFile.createWriteStream({
            metadata: {
              contentType: file.type || 'application/octet-stream',
              cacheControl: 'public, max-age=31536000',
              // 원본 파일명을 메타데이터에 저장
              metadata: {
                originalName: file.name,
                uploadDate: new Date().toISOString(),
              }
            },
          });

          stream.on('error', reject);
          stream.on('finish', resolve);
          stream.end(buffer);
        });

        // 백엔드에서만 접근 가능한 내부 URL 저장 (공개 URL 대신)
        const internalPath = filePath; // GCS 내부 경로
        
        uploadResults.push({
          name: file.name, // 원본 파일명
          url: internalPath, // Firebase에 저장할 내부 경로
          size: file.size,
          type: file.type || 'application/octet-stream'
        });

        console.log(`파일 업로드 완료: ${file.name} -> ${filePath}`);
      } catch (error) {
        console.error(`파일 ${file.name} 업로드 실패:`, error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        return NextResponse.json(
          { error: `파일 ${file.name} 업로드에 실패했습니다.` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      files: uploadResults,
      message: `${uploadResults.length}개 파일이 성공적으로 업로드되었습니다.`
    });

  } catch (error) {
    console.error('파일 업로드 API 에러:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
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

    if (!filePath) {
      return NextResponse.json(
        { error: '파일 경로가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const file = bucket.file(filePath);
    await file.delete();

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('파일 삭제 API 에러:', error);
    return NextResponse.json(
      { error: '파일 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}