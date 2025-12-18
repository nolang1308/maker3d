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
  DocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// 포트폴리오 타입 정의
export interface Portfolio {
  id: string;
  title: string;
  category: string; // 피규어, 부품, 외주 개발
  imageUrl: string; // 히어로 이미지
  thumbnailUrl?: string; // 목록용 썸네일
  content: string;
  writer: string;
  writerId: string;
  createdAt: Date;
  updatedAt: Date;
  views: number;
}

// Firestore 문서를 Portfolio 타입으로 변환
function documentToPortfolio(doc: DocumentSnapshot): Portfolio | null {
  if (!doc.exists()) return null;

  const data = doc.data();
  return {
    id: doc.id,
    title: data.title || '',
    category: data.category || '',
    imageUrl: data.imageUrl || '',
    thumbnailUrl: data.thumbnailUrl || data.imageUrl || '',
    content: data.content || '',
    writer: data.writer || '',
    writerId: data.writerId || '',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
    views: data.views || 0
  };
}

// 포트폴리오 목록 조회
export async function getPortfolios(
  limitCount: number = 20
): Promise<{
  portfolios: Portfolio[];
  totalCount: number;
  hasMore: boolean;
}> {
  try {
    const validLimit = limitCount && limitCount > 0 ? limitCount : 20;

    const portfoliosRef = collection(db, 'portfolios');
    const portfoliosQuery = query(
      portfoliosRef,
      orderBy('createdAt', 'desc'),
      limit(validLimit)
    );

    const snapshot = await getDocs(portfoliosQuery);
    const portfolios: Portfolio[] = [];

    snapshot.forEach((doc) => {
      const portfolio = documentToPortfolio(doc);
      if (portfolio) {
        portfolios.push(portfolio);
      }
    });

    return {
      portfolios,
      totalCount: portfolios.length,
      hasMore: snapshot.docs.length === validLimit
    };
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    return {
      portfolios: [],
      totalCount: 0,
      hasMore: false
    };
  }
}

// 개별 포트폴리오 조회
export async function getPortfolio(id: string): Promise<Portfolio | null> {
  try {
    const portfolioDoc = await getDoc(doc(db, 'portfolios', id));
    return documentToPortfolio(portfolioDoc);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    return null;
  }
}

// 포트폴리오 폼 데이터 타입
export interface PortfolioFormData {
  title: string;
  category: string;
  content: string;
  imageFile: File; // 이미지 파일
}

// 포트폴리오 생성
export async function createPortfolio(
  formData: PortfolioFormData,
  writerId: string,
  writerName: string
): Promise<Portfolio> {
  try {
    let imageUrl = '';

    // 이미지 파일 업로드
    if (formData.imageFile) {
      try {
        console.log('이미지 업로드 시작:', formData.imageFile.name);
        const uploadFormData = new FormData();
        uploadFormData.append('image', formData.imageFile);

        // 직접 백엔드로 호출 (Vercel 제한 우회)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const uploadResponse = await fetch(`${backendUrl}/api/upload-portfolio-image`, {
          method: 'POST',
          body: uploadFormData
        });

        console.log('업로드 응답 상태:', uploadResponse.status);

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          imageUrl = uploadResult.imageUrl || '';
          console.log('이미지 업로드 성공:', imageUrl);
        } else {
          const errorData = await uploadResponse.json();
          console.error('이미지 업로드 실패:', uploadResponse.status, errorData);
          throw new Error(errorData.error || '이미지 업로드에 실패했습니다.');
        }
      } catch (uploadError) {
        console.error('이미지 업로드 에러:', uploadError);
        throw uploadError;
      }
    } else {
      throw new Error('이미지 파일이 필요합니다.');
    }

    // 포트폴리오 문서 생성
    const newPortfolioData = {
      title: formData.title,
      category: formData.category,
      imageUrl: imageUrl,
      thumbnailUrl: imageUrl,
      content: formData.content,
      writer: writerName,
      writerId: writerId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      views: 0
    };

    const docRef = await addDoc(collection(db, 'portfolios'), newPortfolioData);

    return {
      id: docRef.id,
      title: formData.title,
      category: formData.category,
      imageUrl: imageUrl,
      thumbnailUrl: imageUrl,
      content: formData.content,
      writer: writerName,
      writerId: writerId,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0
    };
  } catch (error) {
    console.error('Error creating portfolio:', error);
    throw error;
  }
}

// 포트폴리오 수정용 폼 데이터 타입
export interface PortfolioUpdateFormData {
  title: string;
  category: string;
  content: string;
  imageFile?: File; // 새로운 이미지 파일 (선택사항)
  keepExistingImage?: boolean; // 기존 이미지 유지 여부
}

// 포트폴리오 수정
export async function updatePortfolio(
  id: string,
  formData: PortfolioUpdateFormData,
  existingImageUrl?: string
): Promise<Portfolio | null> {
  try {
    let imageUrl = existingImageUrl || '';

    // 새로운 이미지 파일이 있으면 업로드
    if (formData.imageFile) {
      try {
        console.log('새 이미지 업로드 시작:', formData.imageFile.name);
        const uploadFormData = new FormData();
        uploadFormData.append('image', formData.imageFile);

        // 직접 백엔드로 호출 (Vercel 제한 우회)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const uploadResponse = await fetch(`${backendUrl}/api/upload-portfolio-image`, {
          method: 'POST',
          body: uploadFormData
        });

        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          const newImageUrl = uploadResult.imageUrl || '';
          console.log('새 이미지 업로드 성공:', newImageUrl);

          // 기존 이미지가 있으면 삭제
          if (existingImageUrl && existingImageUrl !== newImageUrl) {
            try {
              await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/delete-portfolio-image?imageUrl=${encodeURIComponent(existingImageUrl)}`, {
                method: 'DELETE'
              });
              console.log('기존 이미지 삭제 완료');
            } catch (deleteError) {
              console.error('기존 이미지 삭제 실패:', deleteError);
            }
          }

          imageUrl = newImageUrl;
        } else {
          const errorData = await uploadResponse.json();
          console.error('이미지 업로드 실패:', errorData);
          throw new Error('이미지 업로드에 실패했습니다.');
        }
      } catch (uploadError) {
        console.error('이미지 업로드 에러:', uploadError);
        throw uploadError;
      }
    }

    // 포트폴리오 문서 업데이트
    const updateData = {
      title: formData.title,
      category: formData.category,
      content: formData.content,
      imageUrl: imageUrl,
      thumbnailUrl: imageUrl,
      updatedAt: Timestamp.now()
    };

    await updateDoc(doc(db, 'portfolios', id), updateData);

    return await getPortfolio(id);
  } catch (error) {
    console.error('Error updating portfolio:', error);
    throw error;
  }
}

// 포트폴리오 삭제
export async function deletePortfolio(id: string): Promise<boolean> {
  try {
    // 포트폴리오 정보를 가져와서 이미지 삭제 (선택사항)
    const portfolio = await getPortfolio(id);

    // TODO: 이미지 파일 삭제 로직 추가 (필요시)

    // Firestore 문서 삭제
    await deleteDoc(doc(db, 'portfolios', id));
    return true;
  } catch (error) {
    console.error('Error deleting portfolio:', error);
    return false;
  }
}

// 조회수 증가
export async function incrementPortfolioViews(id: string): Promise<boolean> {
  try {
    const portfolioRef = doc(db, 'portfolios', id);
    const portfolioDoc = await getDoc(portfolioRef);

    if (portfolioDoc.exists()) {
      const currentViews = portfolioDoc.data().views || 0;
      await updateDoc(portfolioRef, {
        views: currentViews + 1
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error incrementing portfolio views:', error);
    return false;
  }
}
