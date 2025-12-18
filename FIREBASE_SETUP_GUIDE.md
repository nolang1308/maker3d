# Firebase 보안 규칙 설정 가이드

주문 기능을 사용하기 위해 Firebase Console에서 보안 규칙을 설정해야 합니다.

## 1. Firestore 보안 규칙 설정

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 프로젝트 선택: `maker3d-rootiy`
3. 왼쪽 메뉴에서 `Firestore Database` 클릭
4. 상단 탭에서 `규칙(Rules)` 클릭
5. 아래 규칙을 복사하여 붙여넣기:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // orders 컬렉션 - 인증된 사용자만 읽기/쓰기 가능
    match /orders/{orderId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }

    // 기타 컬렉션
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. `게시(Publish)` 버튼 클릭

## 2. Firebase Storage 보안 규칙 설정

1. 왼쪽 메뉴에서 `Storage` 클릭
2. 상단 탭에서 `규칙(Rules)` 클릭
3. 아래 규칙을 복사하여 붙여넣기:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // orders 폴더 - 인증된 사용자만 업로드 가능
    match /orders/{orderId}/{fileName} {
      // 인증된 사용자는 파일 업로드 가능 (50MB 제한)
      allow create: if request.auth != null &&
                      request.resource.size < 50 * 1024 * 1024;

      // 인증된 사용자는 파일 읽기 가능
      allow read: if request.auth != null;

      // 인증된 사용자는 파일 삭제 가능
      allow delete: if request.auth != null;
    }

    // 기타 파일
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. `게시(Publish)` 버튼 클릭

## 3. CORS 설정 (선택사항)

만약 CORS 오류가 계속 발생한다면, Google Cloud Console에서 추가 설정이 필요할 수 있습니다.

### 방법 1: Google Cloud Shell 사용

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택: `maker3d-rootiy`
3. 상단의 Cloud Shell 아이콘 클릭
4. 다음 명령어 실행:

```bash
cat > cors.json <<EOF
[
  {
    "origin": ["http://localhost:3000", "https://your-domain.vercel.app"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
EOF

gsutil cors set cors.json gs://maker3d-rootiy.firebasestorage.app
```

### 방법 2: Firebase CLI 사용 (로컬)

```bash
# Firebase Storage CORS 설정 파일 생성
echo '[
  {
    "origin": ["http://localhost:3000", "https://your-domain.vercel.app"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]' > cors.json

# Google Cloud SDK 설치 후
gsutil cors set cors.json gs://maker3d-rootiy.firebasestorage.app
```

## 4. 테스트

설정 완료 후:
1. 브라우저 캐시 삭제
2. 페이지 새로고침
3. 다시 주문 시도

## 문제 해결

### Firestore 권한 오류가 계속 발생하는 경우:
- Firebase Console > Firestore Database > 규칙 탭에서 규칙이 제대로 적용되었는지 확인
- 규칙 적용 후 몇 분 정도 기다려야 할 수 있음

### Storage 업로드 오류가 계속 발생하는 경우:
- Firebase Console > Storage > 규칙 탭에서 규칙이 제대로 적용되었는지 확인
- CORS 설정이 필요할 수 있음 (위의 CORS 설정 참고)

### 로그인이 안 되는 경우:
- Firebase Console > Authentication > Sign-in method에서 이메일/비밀번호 인증이 활성화되어 있는지 확인
