# 네이버페이 결제 시스템 설정 가이드

## 📋 개요
스토어 상품 페이지에서 "PAY 구매" 버튼을 클릭하면 네이버페이로 결제할 수 있는 기능이 구현되었습니다.

## 🔧 필요한 환경변수 설정

### 1. 네이버페이 API 키
```bash
# .env.local 파일에 추가
NEXT_PUBLIC_NAVER_PAY_CLIENT_ID=your-naver-pay-client-id
NAVER_CLIENT_ID=your-naver-client-id  
NAVER_CLIENT_SECRET=your-naver-client-secret
```

### 2. 기본 URL 설정
```bash
NEXTAUTH_URL=http://localhost:3000  # 개발환경
# 또는 
NEXTAUTH_URL=https://your-domain.com  # 프로덕션
```

## 📝 네이버페이 개발자 설정

### 1. 네이버 개발자센터 설정
1. [네이버 개발자센터](https://developers.naver.com/) 접속
2. **애플리케이션 등록**
3. **네이버페이 결제형** 선택
4. **서비스 환경** 설정:
   - 개발환경: `http://localhost:3000`
   - 운영환경: 실제 도메인
5. **Webhook URL** 설정:
   - `https://your-domain.com/api/payment/success`

### 2. 네이버페이 파트너센터 설정
1. [네이버페이 파트너센터](https://admin.pay.naver.com/) 접속
2. **가맹점 정보** 등록
3. **상품 정보** 등록
4. **결제 설정** 구성

## 🚀 구현된 기능

### 1. 결제 플로우
```
상품 상세 페이지 → PAY 구매 클릭 → 네이버페이 창 → 결제 완료 → 성공 페이지
```

### 2. 주요 컴포넌트
- **결제 SDK**: `/src/utils/naverPay.ts`
- **결제 준비 API**: `/src/app/api/payment/prepare/route.ts`
- **결제 완료 API**: `/src/app/api/payment/success/route.ts`
- **성공 페이지**: `/src/app/payment/success/page.tsx`

### 3. 데이터 저장
결제 완료 시 Firestore `orders` 컬렉션에 다음 정보 저장:
```javascript
{
  orderId: "MK-timestamp-random",
  paymentId: "네이버페이 결제 ID",
  productName: "상품명",
  totalPayAmount: 결제금액,
  paymentStatus: "COMPLETED",
  paymentMethod: "NAVER_PAY", 
  workStatus: 0, // 0: 처리시작
  createdAt: 서버타임스탬프
}
```

## 🔄 결제 프로세스

### 1. 프론트엔드 (상품 페이지)
```typescript
const handleBuyNow = async () => {
  const paymentData = {
    productId,
    productName: product.name,
    totalPayAmount: product.price * quantity,
    quantity,
    selectedOption
  };
  
  await requestNaverPay(paymentData);
};
```

### 2. 결제 준비 (/api/payment/prepare)
- 주문 정보 검증
- 네이버페이 서버에 결제 요청
- paymentId, chainId 반환

### 3. 결제 실행 (네이버페이 창)
- 사용자 결제 진행
- 성공 시 `/payment/success` 페이지로 리다이렉트

### 4. 결제 완료 (/api/payment/success)
- 네이버페이 서버에서 결제 검증
- Firestore에 주문 정보 저장
- 관리자 페이지에서 주문 확인 가능

## 🧪 테스트 방법

### 1. 개발환경 테스트
```bash
# 1. 환경변수 설정
cp .env.local.example .env.local

# 2. 개발서버 실행
npm run dev:all

# 3. 테스트 플로우
# - http://localhost:3000/store 접속
# - 상품 클릭 → 상품 상세 페이지
# - PAY 구매 버튼 클릭
# - 네이버페이 결제창 확인
```

### 2. 결제 테스트
- 네이버페이 개발환경에서는 실제 결제 없이 테스트 가능
- 운영환경 적용 전 충분한 테스트 필요

## 🔐 보안 고려사항

1. **결제 검증**: 서버에서 네이버페이 API로 결제 결과 재검증
2. **환경변수**: 민감한 정보는 환경변수로 관리
3. **HTTPS**: 운영환경에서는 HTTPS 필수
4. **로깅**: 결제 관련 로그 기록 및 모니터링

## 📱 관리자 페이지 연동

결제 완료된 주문은 `/admin/order` 페이지에서 확인 가능:
- workStatus: 0 (대기중)으로 설정
- 관리자가 상태 변경 가능 (처리중 → 배송완료)

## 🛠️ 운영환경 배포 시 체크리스트

- [ ] 네이버페이 운영 API 키 발급 및 설정
- [ ] 실제 도메인으로 Webhook URL 변경
- [ ] HTTPS 설정 확인
- [ ] 결제 테스트 완료
- [ ] 에러 모니터링 설정
- [ ] 주문 관리 프로세스 점검