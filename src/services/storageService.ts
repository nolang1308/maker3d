// 클라이언트에서 API Route를 통해 파일 업로드
export async function uploadNoticeFiles(
  noticeId: string, 
  files: File[]
): Promise<{
  name: string;
  url: string;
  size: number;
  type?: string;
}[]> {
  try {
    const formData = new FormData();
    formData.append('noticeId', noticeId);
    
    // 파일들을 FormData에 추가
    files.forEach(file => {
      formData.append('files', file);
    });

    // 직접 백엔드로 호출 (Vercel 제한 우회)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
    const response = await fetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '파일 업로드에 실패했습니다.');
    }

    const result = await response.json();
    return result.files;
  } catch (error) {
    console.error('파일 업로드 에러:', error);
    throw error;
  }
}

// 개별 파일 삭제 (API Route 통해)
export async function deleteNoticeFile(filePath: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/upload?filePath=${encodeURIComponent(filePath)}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('파일 삭제 실패');
    }

    return true;
  } catch (error) {
    console.error('파일 삭제 에러:', error);
    return false;
  }
}

// 공지사항의 모든 파일 삭제
export async function deleteNoticeFiles(noticeId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/upload/folder?noticeId=${noticeId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('폴더 삭제 실패');
    }

    return true;
  } catch (error) {
    console.error('폴더 삭제 에러:', error);
    return false;
  }
}

// 파일 다운로드 URL 생성
export function getDownloadUrl(filePath: string, fileName: string): string {
  return `/api/download?path=${encodeURIComponent(filePath)}&name=${encodeURIComponent(fileName)}`;
}