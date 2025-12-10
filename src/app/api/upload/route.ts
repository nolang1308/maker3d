import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정
let storage: Storage;
let bucket: any;

try {
  console.log('Initializing Google Cloud Storage...');
  console.log('Environment check:', {
    hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    hasCredentialsJson: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    hasCredentialsFile: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
  });
  
  // 다중 인증 방식 시도
  let storageOptions: any = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  };

  // 방법 1: JSON 환경변수 사용
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson);
      storageOptions.credentials = credentials;
      console.log('Using JSON credentials');
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      // JSON 파싱 실패 시 파일 방식으로 폴백
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        console.log('Falling back to keyFilename');
      }
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // 방법 2: 파일 경로 사용 (로컬 개발용)
    storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Using keyFilename');
  } else {
    // 방법 3: Application Default Credentials (GCE, Cloud Run 등)
    console.log('Using Application Default Credentials');
  }

  storage = new Storage(storageOptions);
  const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d';
  bucket = storage.bucket(bucketName);
  console.log('GCS initialized with options:', Object.keys(storageOptions));
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
        const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d';
        console.log(`버킷 '${bucketName}'이 존재하지 않아 생성을 시도합니다...`);
        
        try {
          // 버킷 자동 생성
          await bucket.create({
            location: 'US', // 또는 원하는 리전
            storageClass: 'STANDARD'
          });
          console.log(`버킷 '${bucketName}' 생성 완료`);
        } catch (createError) {
          console.error('버킷 생성 실패:', createError);
          return NextResponse.json(
            { 
              error: `버킷 '${bucketName}'이 존재하지 않으며 생성에도 실패했습니다.`,
              details: 'Google Cloud Console에서 수동으로 버킷을 생성해주세요.'
            },
            { status: 500 }
          );
        }
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
        console.error('Error stack:', (error as Error).stack);
        console.error('Error message:', (error as Error).message);
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