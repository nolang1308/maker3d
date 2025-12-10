import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

// Google Cloud Storage 설정 (업로드 API와 동일한 설정 사용)
let storage: Storage;
let bucket: any;

try {
  console.log('Initializing Google Cloud Storage for folder operations...');
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
      console.log('Using JSON credentials for folder operations');
    } catch (jsonError) {
      console.error('JSON parsing error for folder operations:', jsonError);
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        console.log('Falling back to keyFilename for folder operations');
      }
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    storageOptions.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    console.log('Using keyFilename for folder operations');
  } else {
    console.log('Using Application Default Credentials for folder operations');
  }

  storage = new Storage(storageOptions);
  const bucketName = process.env.GOOGLE_CLOUD_BUCKET_NAME || 'maker3d';
  bucket = storage.bucket(bucketName);
  console.log('GCS initialized for folder operations with bucket:', bucketName);
} catch (error) {
  console.error('GCS initialization error for folder operations:', error);
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noticeId = searchParams.get('noticeId');

    console.log('Folder deletion request for noticeId:', noticeId);

    if (!noticeId) {
      console.error('Missing noticeId parameter');
      return NextResponse.json(
        { error: '공지사항 ID가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 해당 공지사항 폴더의 모든 파일 조회
    const prefix = `notices/${noticeId}/`;
    console.log('Searching for files with prefix:', prefix);
    
    const [files] = await bucket.getFiles({
      prefix: prefix
    });
    
    console.log(`Found ${files.length} files to delete`);
    
    if (files.length === 0) {
      console.log('No files found to delete');
      return NextResponse.json({ 
        success: true,
        deletedCount: 0,
        message: '삭제할 파일이 없습니다.'
      });
    }

    // 파일 목록 로깅
    files.forEach((file: any) => {
      console.log('File to delete:', file.name);
    });
    
    // 모든 파일 삭제
    const deletePromises = files.map((file: any) => file.delete());
    await Promise.all(deletePromises);

    console.log(`Successfully deleted ${files.length} files`);

    return NextResponse.json({ 
      success: true,
      deletedCount: files.length,
      message: `${files.length}개 파일이 삭제되었습니다.`
    });

  } catch (error) {
    console.error('폴더 삭제 API 에러:', error);
    console.error('Error stack:', (error as Error).stack);
    return NextResponse.json(
      { 
        error: '폴더 삭제에 실패했습니다.',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}