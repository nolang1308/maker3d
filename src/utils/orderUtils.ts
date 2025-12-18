import { db } from '@/config/firebase';
import {
  collection,
  query,
  getDocs,
  setDoc,
  doc
} from 'firebase/firestore';

// 주문번호 생성 함수 (MK-YYYYMMDD-순서)
export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;

  try {
    // 오늘 날짜로 시작하는 모든 주문 문서 가져오기
    const ordersRef = collection(db, 'orders');
    const allOrdersQuery = query(ordersRef);
    const querySnapshot = await getDocs(allOrdersQuery);

    let maxSequence = 0;
    const todayPrefix = `MK-${dateString}-`;

    // 오늘 날짜의 주문번호 중 가장 큰 순서번호 찾기
    querySnapshot.forEach((doc) => {
      const orderId = doc.id;
      if (orderId.startsWith(todayPrefix)) {
        const parts = orderId.split('-');
        if (parts.length === 3) {
          const sequence = parseInt(parts[2]);
          if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
    });

    const nextNumber = maxSequence + 1;
    return `MK-${dateString}-${nextNumber}`;
  } catch (error) {
    console.error('주문번호 생성 오류:', error);
    // 오류 발생 시 타임스탬프 기반으로 생성
    const timestamp = Date.now() % 10000;
    return `MK-${dateString}-${timestamp}`;
  }
}

// STL 파일을 백엔드 서버에 업로드
export async function uploadSTLFiles(
  files: File[],
  orderNumber: string
): Promise<string[]> {
  try {
    const formData = new FormData();
    formData.append('orderNumber', orderNumber);

    // 모든 파일을 FormData에 추가
    files.forEach((file) => {
      formData.append('files', file);
    });

    // 직접 백엔드로 호출 (Vercel 제한 우회)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
    const response = await fetch(`${backendUrl}/api/upload-order-files`, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '파일 업로드 실패');
    }

    // 백엔드 서버의 파일 경로 반환
    return result.filePaths;
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    throw error;
  }
}

// 주문 정보 인터페이스
export interface OrderData {
  customerName: string;
  phoneNumber: string;
  email: string;
  fileUrls: string[];
  files: Array<{
    fileName: string;
    material: string;
    color: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  paymentStatus: 'pending' | 'completed' | 'failed';
  orderDate: string;
  orderTime: string;
  workStatus: 'pending' | 'processing' | 'completed' | 'cancelled';
}

// Firestore에 주문 정보 저장
export async function saveOrder(
  orderNumber: string,
  orderData: OrderData
): Promise<void> {
  try {
    // 주문번호를 문서 ID로 사용
    const orderRef = doc(db, 'orders', orderNumber);
    await setDoc(orderRef, {
      ...orderData,
      createdAt: new Date().toISOString()
    });

    console.log('주문 저장 완료:', orderNumber);
  } catch (error) {
    console.error('주문 저장 오류:', error);
    throw error;
  }
}
