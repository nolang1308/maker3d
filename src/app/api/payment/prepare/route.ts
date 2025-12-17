import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔍 Payment prepare API - Received body:', JSON.stringify(body, null, 2));
    
    const { 
      productId, 
      productName, 
      totalPayAmount, 
      quantity, 
      selectedOption,
      orderId 
    } = body;

    console.log('🔍 Extracted values:', {
      productId,
      productName,
      totalPayAmount,
      quantity,
      selectedOption,
      orderId
    });

    // 입력 검증
    if (!productId || !productName || !totalPayAmount || !quantity || !orderId) {
      console.log('❌ Missing required parameters:', {
        hasProductId: !!productId,
        hasProductName: !!productName,
        hasTotalPayAmount: !!totalPayAmount,
        hasQuantity: !!quantity,
        hasOrderId: !!orderId
      });
      
      return NextResponse.json(
        { success: false, message: '필수 파라미터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 네이버페이 서버 API를 호출하여 결제 준비
    // 실제로는 네이버페이 서버와 통신하여 paymentId와 chainId를 받아와야 합니다.
    const naverPayApiUrl = 'https://dev.apis.naver.com/naverpay-partner/naverpay/payments/v2.2/apply/payment';
    
    const paymentRequest = {
      "merchantPayKey": orderId,
      "productName": productName,
      "totalPayAmount": totalPayAmount,
      "taxScopeAmount": totalPayAmount,
      "taxExScopeAmount": 0,
      "returnUrl": `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/payment/success`,
      "productItems": [
        {
          "categoryType": "PRODUCT",
          "categoryId": "PRODUCT", 
          "uid": productId,
          "name": productName,
          "payReferrer": "NAVER_SEARCH",
          "count": quantity
        }
      ]
    };

    // 네이버페이 API 호출 (실제 구현에서는 서버 인증서와 함께 호출)
    const naverPayResponse = await fetch(naverPayApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID || '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET || '',
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!naverPayResponse.ok) {
      console.error('네이버페이 API 오류:', await naverPayResponse.text());
      
      // 개발 환경에서는 더미 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({
          success: true,
          paymentId: `test-payment-${orderId}`,
          chainId: `test-chain-${Date.now()}`,
          orderId: orderId
        });
      }
      
      throw new Error('네이버페이 API 호출 실패');
    }

    const naverPayResult = await naverPayResponse.json();
    
    // 결제 정보를 데이터베이스에 임시 저장 (선택사항)
    // await savePaymentPrepareInfo({
    //   orderId,
    //   productId,
    //   productName,
    //   totalPayAmount,
    //   quantity,
    //   selectedOption,
    //   paymentId: naverPayResult.body.paymentId,
    //   status: 'PREPARED'
    // });

    return NextResponse.json({
      success: true,
      paymentId: naverPayResult.body.paymentId,
      chainId: naverPayResult.body.chainId,
      orderId: orderId
    });

  } catch (error) {
    console.error('결제 준비 API 오류:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: '결제 준비 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}