# 🚀 백엔드 및 Cloudflare Tunnel 시작 가이드

HTTPS 백엔드를 설정하여 Vercel에 배포된 웹페이지에서 네이버 스토어 API를 호출할 수 있도록 합니다.

---

## ⚡ 빠른 시작

### 1. cloudflared 다운로드

**다운로드 링크**: https://github.com/cloudflare/cloudflared/releases/latest

1. `cloudflared-windows-amd64.exe` 파일 다운로드
2. 이 파일을 `C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend` 폴더에 저장
3. 파일명을 `cloudflared.exe`로 변경

---

### 2. Cloudflare 인증

PowerShell 또는 CMD를 **관리자 권한**으로 열고:

```bash
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend
.\cloudflared.exe tunnel login
```

- 브라우저가 자동으로 열립니다
- Cloudflare에 로그인 (새 계정 생성 가능: https://dash.cloudflare.com/sign-up)
- "You have successfully logged in" 확인

---

### 3. 터널 생성

```bash
.\cloudflared.exe tunnel create maker3d-backend
```

**중요**: 출력된 UUID를 복사하세요!

예시:
```
Created tunnel maker3d-backend with id abcd1234-5678-90ef-ghij-klmnopqrstuv
Tunnel credentials written to C:\Users\rlaal\.cloudflared\abcd1234-5678-90ef-ghij-klmnopqrstuv.json
```

UUID: `abcd1234-5678-90ef-ghij-klmnopqrstuv` (이 부분을 복사!)

---

### 4. config.yml 수정

`backend/config.yml` 파일을 열어서 다음 두 곳을 수정하세요:

```yaml
tunnel: abcd1234-5678-90ef-ghij-klmnopqrstuv  # ← 3단계에서 복사한 UUID
credentials-file: C:\Users\rlaal\.cloudflared\abcd1234-5678-90ef-ghij-klmnopqrstuv.json  # ← UUID 포함된 경로

ingress:
  - hostname: maker3d-backend.cfargotunnel.com
    service: http://localhost:10000
  - service: http_status:404
```

---

### 5. DNS 설정

```bash
.\cloudflared.exe tunnel route dns maker3d-backend maker3d-backend.cfargotunnel.com
```

**성공 메시지 확인**:
```
Added CNAME maker3d-backend.cfargotunnel.com which will route to this tunnel
```

---

### 6. concurrently 패키지 설치

백엔드 폴더에서:

```bash
npm install
```

---

### 7. 백엔드 & 터널 실행

**방법 1: 한 번에 실행 (권장)**

```bash
npm run dev:all
```

이 명령어는 다음 두 개를 동시에 실행합니다:
- 백엔드 서버 (포트 10000)
- Cloudflare Tunnel

**방법 2: 따로 실행**

터미널 1:
```bash
npm run dev
```

터미널 2:
```bash
npm run tunnel
```

---

### 8. 연결 테스트

브라우저에서 다음 URL로 접속:

1. **로컬 테스트**: http://localhost:10000
   - 응답: `{"message": "Backend server is running!"}`

2. **HTTPS 테스트**: https://maker3d-backend.cfargotunnel.com
   - 응답: `{"message": "Backend server is running!"}`

**두 URL 모두 정상 응답이 나오면 성공! ✅**

---

### 9. Vercel 환경변수 설정

1. **Vercel Dashboard** 접속: https://vercel.com/dashboard
2. 프로젝트 선택
3. **Settings** > **Environment Variables**
4. 추가:

```
Name: NEXT_PUBLIC_BACKEND_URL
Value: https://maker3d-backend.cfargotunnel.com
```

5. **Redeploy** 클릭

---

### 10. 프론트엔드에서 테스트

Vercel에 배포된 사이트에서:
1. **스토어 페이지** 접속 (`/store`)
2. 네이버 스토어 상품이 정상적으로 로드되는지 확인
3. 상품 클릭 → 상세 페이지 확인

---

## 🔄 Windows 시작 시 자동 실행 설정

### 방법 1: Windows 서비스로 등록 (권장)

관리자 권한 PowerShell:

```bash
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend
.\cloudflared.exe service install
```

서비스 시작:
```bash
net start cloudflared
```

### 방법 2: 작업 스케줄러

1. `Win + S` → "작업 스케줄러" 검색
2. "기본 작업 만들기" 선택
3. 트리거: "컴퓨터를 시작할 때"
4. 작업: "프로그램 시작"
5. 프로그램: `C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend\cloudflared.exe`
6. 인수 추가: `tunnel --config C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend\config.yml run maker3d-backend`

### 방법 3: 시작 프로그램 폴더

1. `Win + R` → `shell:startup` 입력
2. 배치 파일 생성 `start-maker3d.bat`:

```batch
@echo off
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend
start "" cloudflared.exe tunnel --config config.yml run maker3d-backend
start "" npm run dev
```

3. 배치 파일을 시작 프로그램 폴더로 이동

---

## 🛠️ 문제 해결

### 터널이 시작되지 않는 경우

```bash
# 터널 목록 확인
.\cloudflared.exe tunnel list

# 기존 터널 삭제 후 재생성
.\cloudflared.exe tunnel delete maker3d-backend
.\cloudflared.exe tunnel create maker3d-backend
```

### HTTPS URL이 작동하지 않는 경우

```bash
# DNS 확인
nslookup maker3d-backend.cfargotunnel.com

# DNS 재설정
.\cloudflared.exe tunnel route dns maker3d-backend maker3d-backend.cfargotunnel.com
```

### 백엔드가 연결되지 않는 경우

1. 백엔드 서버가 포트 10000에서 실행 중인지 확인
   ```bash
   npm run dev
   ```

2. `config.yml`의 `service: http://localhost:10000` 확인

3. Windows 방화벽 확인

---

## 📋 전체 명령어 요약

```bash
# 1. backend 폴더로 이동
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend

# 2. Cloudflare 인증
.\cloudflared.exe tunnel login

# 3. 터널 생성 (UUID 복사)
.\cloudflared.exe tunnel create maker3d-backend

# 4. config.yml 수정 (UUID 입력)

# 5. DNS 설정
.\cloudflared.exe tunnel route dns maker3d-backend maker3d-backend.cfargotunnel.com

# 6. 패키지 설치
npm install

# 7. 백엔드 + 터널 실행
npm run dev:all

# 8. 테스트
# 로컬: http://localhost:10000
# HTTPS: https://maker3d-backend.cfargotunnel.com

# 9. Vercel 환경변수 설정
# NEXT_PUBLIC_BACKEND_URL=https://maker3d-backend.cfargotunnel.com
```

---

## ✅ 완료 체크리스트

- [ ] cloudflared.exe 다운로드 완료
- [ ] Cloudflare 인증 완료
- [ ] 터널 생성 완료 (UUID 복사)
- [ ] config.yml 수정 완료
- [ ] DNS 설정 완료
- [ ] npm install 완료
- [ ] 백엔드 서버 실행 중 (포트 10000)
- [ ] 터널 실행 중
- [ ] http://localhost:10000 테스트 성공
- [ ] https://maker3d-backend.cfargotunnel.com 테스트 성공
- [ ] Vercel 환경변수 업데이트 완료
- [ ] Vercel 재배포 완료
- [ ] 프론트엔드에서 네이버 스토어 API 호출 성공

---

## 💰 비용 및 보안

- **Cloudflare Tunnel**: 완전 무료
- **대역폭**: 무제한
- **SSL/TLS**: 자동 적용
- **DDoS 보호**: 자동 적용
- **공개 IP 노출**: 없음 (안전)

---

## 📚 추가 자료

- **Cloudflare Tunnel 문서**: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- **Cloudflare Dashboard**: https://dash.cloudflare.com/
- **상세 가이드**: `CLOUDFLARE_TUNNEL_SETUP.md` 참고

---

**문제가 발생하면 다음을 확인하세요:**
1. 백엔드 서버가 포트 10000에서 실행 중인가?
2. 터널이 실행 중인가?
3. config.yml의 UUID가 올바른가?
4. DNS 설정이 완료되었는가?
5. Vercel 환경변수가 올바르게 설정되었는가?
