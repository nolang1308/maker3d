import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      paymentId, 
      merchantPayKey, 
      resultCode, 
      resultMessage,
      totalPayAmount,
      productName
    } = body;

    console.log('결제 완료 콜백 수신:', body);

    // 결제 성공 여부 확인
    if (resultCode !== 'Success') {
      console.error('결제 실패:', resultMessage);
      return NextResponse.json(
        { success: false, message: resultMessage },
        { status: 400 }
      );
    }

    // 네이버페이 서버에 결제 결과 검증 요청 (보안을 위해 필수)
    const verifyPaymentResult = await verifyNaverPayment(paymentId);
    
    if (!verifyPaymentResult.success) {
      console.error('결제 검증 실패:', verifyPaymentResult.message);
      return NextResponse.json(
        { success: false, message: '결제 검증에 실패했습니다.' },
        { status: 400 }
      );
    }

    // 주문 정보를 Firestore에 저장
    const orderData = {
      orderId: merchantPayKey,
      paymentId: paymentId,
      productName: productName,
      totalPayAmount: totalPayAmount,
      paymentStatus: 'COMPLETED',
      paymentMethod: 'NAVER_PAY',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      // 추가 정보들 (필요에 따라 확장)
      customerInfo: {
        // 고객 정보는 별도로 받아와야 함
      },
      workStatus: 0, // 0: 처리시작
    };

    // Firestore에 주문 저장
    const docRef = await addDoc(collection(db, 'orders'), orderData);
    
    console.log('주문 저장 완료:', docRef.id);

    return NextResponse.json({
      success: true,
      orderId: merchantPayKey,
      orderDocId: docRef.id,
      message: '주문이 성공적으로 완료되었습니다.'
    });

  } catch (error) {
    console.error('결제 완료 처리 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '주문 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 네이버페이 결제 검증 함수
async function verifyNaverPayment(paymentId: string) {
  try {
    // 네이버페이 결제 검증 API 호출
    const verifyUrl = `https://dev.apis.naver.com/naverpay-partner/naverpay/payments/v2.2/apply/payment/${paymentId}`;
    
    const response = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || '',
      },
    });

    if (!response.ok) {
      console.error('결제 검증 API 오류:', await response.text());
      
      // 개발 환경에서는 성공으로 처리
      if (process.env.NODE_ENV === 'development') {
        return { success: true, message: '개발환경 검증 통과' };
      }
      
      return { success: false, message: '결제 검증 API 호출 실패' };
    }

    const verifyResult = await response.json();
    
    // 결제 상태 확인
    if (verifyResult.body && verifyResult.body.detail && 
        verifyResult.body.detail.paymentStatus === 'PAYMENT_SUCCESS') {
      return { success: true, data: verifyResult.body };
    } else {
      return { success: false, message: '결제 상태가 성공이 아닙니다.' };
    }

  } catch (error) {
    console.error('결제 검증 오류:', error);
    return { success: false, message: '결제 검증 중 오류 발생' };
  }
}