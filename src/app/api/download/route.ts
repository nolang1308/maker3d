import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정 (업로드 API와 동일한 설정 사용)
let storage: Storage;
let bucket: any;

try {
  console.log('Initializing Google Cloud Storage for download...');
  console.log('Environment check:', {
    hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    hasCredentialsJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    hasCredentialsFile: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
  });
  
  let storageOptions: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  };

  // 방법 1: JSON 환경변수 사용
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson);
      storageOptions.credentials = credentials;
      console.log('Using JSON credentials for download');
    } catch (jsonError) {
      console.error('JSON parsing error for download:', jsonError);
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        console.log('Falling back to keyFilename for download');
      }
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Using keyFilename for download');
  } else {
    console.log('Using Application Default Credentials for download');
  }

  storage = new Storage(storageOptions);
  const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d';
  bucket = storage.bucket(bucketName);
  console.log('GCS initialized for download with bucket:', bucketName);
} catch (error) {
  console.error('GCS initialization error for download:', error);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const fileName = searchParams.get('name');

    console.log('Download request:', { filePath, fileName });

    if (!filePath) {
      return NextResponse.json(
        { error: '파일 경로가 누락되었습니다.' },
        { status: 400 }
      );
    }

    if (!fileName) {
      return NextResponse.json(
        { error: '파일 이름이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // GCS 파일 객체 생성
    const file = bucket.file(filePath);
    
    // 파일 존재 확인
    const [exists] = await file.exists();
    if (!exists) {
      console.log('File not found:', filePath);
      return NextResponse.json(
        { error: '파일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    console.log('File exists, starting download:', filePath);

    // 파일 메타데이터 가져오기
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || 'application/octet-stream';
    const fileSize = metadata.size;
    const originalName = metadata.metadata?.originalName || fileName || 'download';

    console.log('File metadata:', { contentType, fileSize, originalName });

    // 파일 스트림 생성
    const stream = file.createReadStream();
    
    // ReadableStream으로 변환
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        
        stream.on('end', () => {
          controller.close();
        });
        
        stream.on('error', (error: Error) => {
          console.error('Stream error:', error);
          controller.error(error);
        });
      },
    });

    // 파일명을 URL 인코딩하되 한글은 그대로 유지
    const encodedFileName = encodeURIComponent(originalName);

    // 파일 다운로드 응답 생성
    const response = new NextResponse(readableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFileName}`,
        'Content-Length': fileSize ? fileSize.toString() : '0',
        'Cache-Control': 'private, no-cache',
      },
    });

    console.log('Download response created successfully for:', originalName);
    return response;

  } catch (error) {
    console.error('파일 다운로드 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { 
        error: '파일 다운로드에 실패했습니다.',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}