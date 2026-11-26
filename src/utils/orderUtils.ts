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
//
// 이 모양은 사이트 밖에서도 읽는다: 팜 관리 프로그램(print-farm-manager 의 server/maker3dOrders.js)이
// orders 문서를 읽어 의뢰 관리에 의뢰로 만든다. 거기서 쓰는 항목은 customerName · phoneNumber · orderEmail ·
// fileUrls · files[] · totalPrice · paymentStatus · workStatus · orderType · clickerSpec · shapeClickerSpec · orderDate · createdAt,
// 그리고 주문번호 형식(MK-YYYYMMDD-N)과 백엔드의 /api/download-order-files/:orderNumber 이다.
// 이 항목들의 이름이나 뜻을 바꾸면 그쪽도 함께 고쳐야 한다 (이 저장소의 시험으로는 드러나지 않는다).
export interface OrderData {
  customerName: string;
  phoneNumber: string;
  orderEmail: string; // 주문 시 입력한 이메일
  userEmail: string; // 로그인한 사용자의 계정 이메일
  fileUrls: string[];
  files: Array<{
    fileName: string;
    material: string;
    color: string;
    colorHex?: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  paymentStatus: 'pending' | 'payment_pending' | 'completed' | 'failed';
  orderDate: string;
  orderTime: string;
  workStatus: 'pending' | 'processing' | 'completed' | 'cancelled';
  paymentId?: string;
  /** 'quote'(실시간 견적) | 'keycap'(키캡제작) | 'clicker'(키보드 클리커) | 'shapeclicker'(쉐이프 클리커). 없으면 견적 주문 */
  orderType?: 'quote' | 'keycap' | 'clicker' | 'shapeclicker';
  /** 키캡제작 주문의 설계 정보 (크기, 색상 매핑 등) */
  keycapSpec?: KeycapOrderSpec;
  /** 키보드 클리커 주문의 제작 정보 (종류, 색상, 사진이 들어간 키 등) */
  clickerSpec?: ClickerOrderSpec;
  /** 쉐이프 클리커 주문의 제작 정보 (크기, 색상, 함께 올린 파일 등) */
  shapeClickerSpec?: ShapeClickerOrderSpec;
}

export interface ShapeClickerOrderSpec {
  /** 올린 로고의 파일 이름. 예시 모양이면 그 이름 */
  logoName: string;
  /** 올린 로고가 아니라 예시 모양으로 만든 것인지 */
  sample: boolean;
  /** 고른 크기(완성품의 긴 쪽)와 로고 둘레 여백 (mm) */
  sizeMm: number;
  marginMm: number;
  /** 완성품의 대략의 크기 (mm) */
  size: { width: number; depth: number; height: number };
  bodyColor: { name: string; hex: string };
  capColor: { name: string; hex: string };
  /** 키링 고리를 다는지, 다는 방향 (위쪽이 0°, 시계 방향) */
  showRing: boolean;
  lugAngle: number;
  /** 모양 보정: 떨어져 있던 조각을 이어 붙였다 / 스위치 자리가 모자라 넓혔다 */
  joined: boolean;
  seatAdded: boolean;
  /** 로고 그림이 누르는 곳 윗면에서 차지하는 크기 (mm) */
  logoSize: { width: number; height: number };
  /** 함께 올린 파일 이름: 몸체 · 누르는 곳(출력용 STL), 로고 그림, 미리보기, 주문 내용 */
  bodyFile: string;
  capFile: string;
  logoFile: string;
  previewFile: string | null;
  infoFile: string;
}

export interface ClickerOrderSpec {
  /** 종류. 직접 입력한 크기는 'custom-가로x세로' */
  layoutId: string;
  layoutLabel: string;
  layoutDescription: string;
  cols: number;
  rows: number;
  keyCount: number;
  /** 준비된 제작용 모델이 없는, 직접 입력한 크기인지 */
  custom: boolean;
  /** 대략의 크기 (mm) */
  size: { width: number; depth: number; height: number };
  caseColor: { name: string; hex: string };
  keycapColor: { name: string; hex: string };
  /** 키링 고리를 다는지 */
  showRing: boolean;
  /** 'each': 키마다 사진 한 장씩, 'span': 사진 한 장을 모든 키에 이어서 */
  photoMode: 'each' | 'span';
  /** 사진이 들어간 키 번호 (1부터). 여기에 없는 키는 키캡 색 그대로 둔다 */
  photoKeys: number[];
  /** 키캡 윗면(사진이 올라가는 면) 한 변의 길이 (mm) */
  printFace: number;
  /** 함께 올린 파일 이름: 키캡 사진, 미리보기, 주문 내용 */
  faceFiles: string[];
  previewFile: string | null;
  infoFile: string;
}

export interface KeycapOrderSpec {
  sourceImageName: string;
  widthUnits: number;
  height: number;
  embossHeight: number;
  imageScale: number;
  dimensions: { bottomWidth: number; bottomDepth: number; totalHeight: number };
  baseColor: { name: string; code: string; hex: string };
  layers: Array<{ fileName: string; name: string; code: string; hex: string; originalHex: string }>;
  filamentCount: number;
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
  } catch (error) {
    console.error('주문 저장 오류:', error);
    throw error;
  }
}
