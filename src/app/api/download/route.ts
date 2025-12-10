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

    console.log('File exists, generating signed URL:', filePath);

    // Signed URL 생성 (1시간 유효)
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + (60 * 60 * 1000), // 1시간
      responseDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    console.log('Signed URL generated successfully');

    // 리다이렉트 응답으로 Signed URL로 이동
    return NextResponse.redirect(signedUrl, 302);

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