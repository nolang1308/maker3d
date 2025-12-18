import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  startAfter, 
  where,
  DocumentSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// 공지사항 타입 정의
export interface Notice {
  id: string;
  title: string;
  content: string;
  author: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
  password?: string;
  isPublic: boolean;
  attachments?: {
    name: string;
    url: string; // 로컬 다운로드 경로 (예: /api/download-notice-file/abc123/1702123456_file.pdf)
    size: number;
    type?: string; // MIME 타입
  }[];
}

// Firestore 문서를 Notice 타입으로 변환
function documentToNotice(doc: DocumentSnapshot): Notice | null {
  if (!doc.exists()) return null;
  
  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    content: data.content || '',
    author: data.author || '',
    authorId: data.authorId || '',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    views: data.views || 0,
    password: data.password,
    isPublic: data.isPublic !== false, // 기본값 true
    attachments: data.attachments || []
  };
}

// 공지사항 목록 조회
export async function getNotices(
  page: number = 1,
  limitCount: number = 20
): Promise<{
  notices: Notice[];
  totalCount: number;
  hasMore: boolean;
  lastDoc?: any;
}> {
  try {
    const validLimit = limitCount && limitCount > 0 ? limitCount : 20;
    
    const noticesRef = collection(db, 'notices');
    const noticesQuery = query(
      noticesRef,
      orderBy('createdAt', 'desc'),
      limit(validLimit)
    );

    const snapshot = await getDocs(noticesQuery);
    const notices: Notice[] = [];
    
    snapshot.forEach((doc) => {
      const notice = documentToNotice(doc);
      if (notice) {
        notices.push(notice);
      }
    });

    return {
      notices,
      totalCount: notices.length,
      hasMore: snapshot.docs.length === validLimit,
      lastDoc: snapshot.docs[snapshot.docs.length - 1]
    };
  } catch (error) {
    console.error('Error fetching notices:', error);
    return {
      notices: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

// 공지사항 검색
export async function searchNotices(
  searchTerm: string,
  page: number = 1,
  limitCount: number = 20
): Promise<{
  notices: Notice[];
  totalCount: number;
  hasMore: boolean;
}> {
  try {
    const noticesRef = collection(db, 'notices');
    const noticesQuery = query(noticesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(noticesQuery);
    
    const allNotices: Notice[] = [];
    snapshot.forEach((doc) => {
      const notice = documentToNotice(doc);
      if (notice) {
        allNotices.push(notice);
      }
    });

    const filteredNotices = allNotices.filter(notice => 
      notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notice.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const validLimit = limitCount && limitCount > 0 ? limitCount : 20;
    const validPage = page && page > 0 ? page : 1;
    
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const paginatedNotices = filteredNotices.slice(startIndex, endIndex);

    return {
      notices: paginatedNotices,
      totalCount: filteredNotices.length,
      hasMore: endIndex < filteredNotices.length
    };
  } catch (error) {
    console.error('Error searching notices:', error);
    return {
      notices: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

// 개별 공지사항 조회
export async function getNotice(id: string): Promise<Notice | null> {
  try {
    const noticeDoc = await getDoc(doc(db, 'notices', id));
    return documentToNotice(noticeDoc);
  } catch (error) {
    console.error('Error fetching notice:', error);
    return null;
  }
}

// 공지사항 폼 데이터 타입
export interface NoticeFormData {
  title: string;
  content: string;
  password?: string;
  isPublic?: boolean;
  files?: File[];
}

// 공지사항 생성
export async function createNotice(
  formData: NoticeFormData,
  authorId: string,
  authorName: string
): Promise<Notice> {
  try {
    // 먼저 공지사항 문서 생성
    const newNoticeData = {
      title: formData.title,
      content: formData.content,
      author: authorName,
      authorId: authorId,
      password: formData.password,
      isPublic: formData.isPublic !== false,
      attachments: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      views: 0
    };

    const docRef = await addDoc(collection(db, 'notices'), newNoticeData);
    
    // 파일이 있다면 백엔드 API를 통해 업로드 처리
    let attachments: { name: string; url: string; size: number; type?: string; }[] = [];
    if (formData.files && formData.files.length > 0) {
      try {
        // 최대 10개 파일 제한
        const validFiles = formData.files.slice(0, 10);
        
        if (validFiles.length > 0) {
          console.log('Preparing to upload files in createNotice:', validFiles.length);

          // 직접 백엔드로 호출 (Vercel 제한 우회)
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
          const uploadResponse = await fetch(`${backendUrl}/api/upload-notice-files`, {
            method: 'POST',
            body: (() => {
              const formData = new FormData();
              formData.append('noticeId', docRef.id);
              validFiles.forEach(file => {
                console.log('Adding file to FormData in createNotice:', file.name);
                formData.append('files', file);
              });
              return formData;
            })()
          });

          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            attachments = uploadResult.files || [];
            
            console.log('File upload successful in createNotice:', attachments);
            
            // 첨부파일 정보를 Firestore 문서에 업데이트
            await updateDoc(docRef, {
              attachments: attachments,
              updatedAt: Timestamp.now()
            });
          } else {
            const errorData = await uploadResponse.json();
            console.error('파일 업로드 API 에러:', uploadResponse.status, errorData);
            // 파일 업로드 실패해도 공지사항은 생성됨
          }
        }
      } catch (uploadError) {
        console.error('파일 업로드 처리 에러:', uploadError);
        // 파일 업로드 실패해도 공지사항은 생성됨
      }
    }
    
    return {
      id: docRef.id,
      title: formData.title,
      content: formData.content,
      author: authorName,
      authorId: authorId,
      password: formData.password,
      isPublic: formData.isPublic !== false,
      attachments: attachments,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0
    };
  } catch (error) {
    console.error('Error creating notice:', error);
    throw error;
  }
}

// 공지사항 수정
export async function updateNotice(id: string, updates: Partial<Notice>): Promise<Notice | null> {
  try {
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    await updateDoc(doc(db, 'notices', id), updateData);
    
    return await getNotice(id);
  } catch (error) {
    console.error('Error updating notice:', error);
    return null;
  }
}

// 공지사항 삭제
export async function deleteNotice(id: string): Promise<boolean> {
  try {
    // 먼저 공지사항 정보를 가져와서 첨부파일 목록 확인
    const notice = await getNotice(id);
    
    // 첨부파일이 있다면 개별적으로 삭제 시도
    if (notice && notice.attachments && notice.attachments.length > 0) {
      console.log(`Attempting to delete ${notice.attachments.length} attachments for notice ${id}`);
      
      const deletePromises = notice.attachments.map(async (attachment) => {
        try {
          const deleteResponse = await fetch(`/api/upload?filePath=${encodeURIComponent(attachment.url)}`, {
            method: 'DELETE'
          });
          
          if (!deleteResponse.ok) {
            console.error(`첨부파일 ${attachment.name} 삭제 실패`);
          } else {
            console.log(`첨부파일 ${attachment.name} 삭제 성공`);
          }
        } catch (fileError) {
          console.error(`첨부파일 ${attachment.name} 삭제 에러:`, fileError);
        }
      });
      
      // 모든 첨부파일 삭제를 시도하지만 실패해도 진행
      await Promise.allSettled(deletePromises);
    }
    
    // Firestore 문서 삭제
    await deleteDoc(doc(db, 'notices', id));
    return true;
  } catch (error) {
    console.error('Error deleting notice:', error);
    return false;
  }
}

// 조회수 증가
export async function incrementNoticeViews(id: string): Promise<boolean> {
  try {
    const noticeRef = doc(db, 'notices', id);
    const noticeDoc = await getDoc(noticeRef);
    
    if (noticeDoc.exists()) {
      const currentViews = noticeDoc.data().views || 0;
      await updateDoc(noticeRef, {
        views: currentViews + 1
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error incrementing notice views:', error);
    return false;
  }
}