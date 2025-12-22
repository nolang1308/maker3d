// 네이버페이 결제 관련 유틸리티 함수

export interface PaymentData {
  productId: string;
  productName: string;
  totalPayAmount: number;
  quantity: number;
  selectedOption?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

// 네이버페이 SDK 초기화
export const initializeNaverPay = () => {
  return new Promise<void>((resolve, reject) => {
    // 네이버페이 SDK가 이미 로드되어 있으면 바로 resolve
    if (typeof window !== 'undefined' && (window as any).Naver) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://nsp.pay.naver.com/sdk/js/naverpay.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('네이버페이 SDK 로드 실패'));
    
    document.head.appendChild(script);
  });
};

// 주문 번호 생성
export const generateOrderId = (): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  return `MK-${timestamp}-${randomId}`;
};

// 네이버페이 결제 요청
export const requestNaverPay = async (paymentData: PaymentData) => {
  try {
    await initializeNaverPay();
    
    const orderId = generateOrderId();
    
    // 네이버페이 객체 생성
    const oPay = (window as any).Naver.Pay.create({
      "mode": "development", // 샌드박스 모드
      "clientId": process.env.NEXT_PUBLIC_NAVER_PAY_CLIENT_ID,
      "chainId": process.env.NEXT_PUBLIC_NAVER_PAY_CHAIN_ID,
    });

    // 공식 예제와 동일한 파라미터 구조 사용
    const paymentInfo = {
      "merchantPayKey": orderId,
      "productName": paymentData.productName,
      "productCount": paymentData.quantity.toString(),
      "totalPayAmount": paymentData.totalPayAmount.toString(),
      "taxScopeAmount": paymentData.totalPayAmount.toString(),
      "taxExScopeAmount": "0",
      "returnUrl": `${window.location.origin}/payment/success`
    };

    // 결제 창 열기
    oPay.open(paymentInfo);
    
    return {
      success: true,
      orderId,
    };

  } catch (error) {
    console.error('네이버페이 결제 오류:', error);
    throw error;
  }
};