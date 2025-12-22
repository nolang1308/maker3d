# Cloudflare Tunnel 설정 가이드

Windows PC에서 HTTP 백엔드를 HTTPS로 외부에 노출시키는 방법입니다.

## 🔧 사전 준비

- Cloudflare 계정 (무료) - https://dash.cloudflare.com/sign-up
- 도메인 (선택사항, Cloudflare에서 무료 서브도메인 제공 가능)

---

## 📥 1단계: cloudflared 다운로드

1. **다운로드 링크**: https://github.com/cloudflare/cloudflared/releases/latest
2. **파일명**: `cloudflared-windows-amd64.exe` (Windows 64비트)
3. **저장 위치**: 이 파일을 현재 backend 폴더에 저장
4. **이름 변경**: `cloudflared.exe`로 이름 변경

```bash
# 현재 위치 확인
C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend\cloudflared.exe
```

---

## 🔐 2단계: Cloudflare 인증

PowerShell 또는 CMD를 **관리자 권한**으로 실행:

```bash
# backend 폴더로 이동
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend

# Cloudflare 인증
.\cloudflared.exe tunnel login
```

**결과**:
- 브라우저가 자동으로 열립니다
- Cloudflare에 로그인 (새 계정 생성 가능)
- 도메인 선택 (없으면 스킵)
- "You have successfully logged in" 메시지 확인

인증 파일이 생성됩니다: `C:\Users\rlaal\.cloudflared\cert.pem`

---

## 🚇 3단계: 터널 생성

```bash
.\cloudflared.exe tunnel create maker3d-backend
```

**결과**:
```
Tunnel credentials written to C:\Users\rlaal\.cloudflared\<UUID>.json
Created tunnel maker3d-backend with id <UUID>
```

**중요**: 출력된 UUID를 복사해두세요! (예: `abcd1234-5678-90ef-ghij-klmnopqrstuv`)

---

## ⚙️ 4단계: 설정 파일 수정

`backend/config.yml` 파일을 수정합니다:

```yaml
tunnel: <YOUR_TUNNEL_UUID>  # 3단계에서 복사한 UUID
credentials-file: C:\Users\rlaal\.cloudflared\<YOUR_TUNNEL_UUID>.json

ingress:
  - hostname: maker3d-backend.cfargotunnel.com  # 원하는 서브도메인
    service: http://localhost:10000
  - service: http_status:404
```

**변경할 내용**:
1. `<YOUR_TUNNEL_UUID>` → 실제 UUID로 변경
2. `maker3d-backend.cfargotunnel.com` → 원하는 도메인/서브도메인

---

## 🌐 5단계: DNS 설정

```bash
.\cloudflared.exe tunnel route dns maker3d-backend maker3d-backend.cfargotunnel.com
```

**또는 Cloudflare Dashboard에서 설정**:
1. https://dash.cloudflare.com/ 접속
2. Zero Trust > Access > Tunnels 메뉴
3. 생성한 터널 선택
4. Public Hostname 추가:
   - Subdomain: `maker3d-backend`
   - Domain: `cfargotunnel.com` (또는 본인 도메인)
   - Service: `http://localhost:10000`

---

## 🚀 6단계: 터널 실행

### 방법 1: 직접 실행 (테스트용)

```bash
.\cloudflared.exe tunnel --config config.yml run maker3d-backend
```

### 방법 2: 백그라운드 실행 (권장)

```bash
.\cloudflared.exe service install
.\cloudflared.exe --config config.yml service install
```

### 방법 3: npm 스크립트 사용

`package.json`에 추가:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "tunnel": "cloudflared.exe tunnel --config config.yml run maker3d-backend",
    "dev:all": "concurrently \"npm run dev\" \"npm run tunnel\""
  }
}
```

실행:
```bash
npm run dev:all
```

---

## ✅ 7단계: 연결 테스트

백엔드 서버와 터널이 모두 실행된 상태에서:

1. **로컬 테스트**: http://localhost:10000
2. **HTTPS 테스트**: https://maker3d-backend.cfargotunnel.com

브라우저에서 HTTPS URL로 접속하여 다음 응답을 확인:

```json
{
  "message": "Backend server is running!",
  "serverIP": "..."
}
```

---

## 🔧 8단계: 프론트엔드 환경변수 업데이트

### Vercel 환경변수 설정

1. Vercel Dashboard 접속
2. 프로젝트 선택 > Settings > Environment Variables
3. 추가:

```
NEXT_PUBLIC_BACKEND_URL=https://maker3d-backend.cfargotunnel.com
```

4. Redeploy

### 로컬 개발 환경

프로젝트 루트에 `.env.local` 파일 생성 또는 수정:

```env
NEXT_PUBLIC_BACKEND_URL=https://maker3d-backend.cfargotunnel.com
```

---

## 📋 전체 실행 순서

1. **백엔드 서버 시작**:
   ```bash
   cd backend
   npm run dev
   ```

2. **터널 시작** (새 터미널):
   ```bash
   cd backend
   .\cloudflared.exe tunnel --config config.yml run maker3d-backend
   ```

3. **프론트엔드 개발 서버** (선택사항):
   ```bash
   npm run dev
   ```

---

## 🛠️ 문제 해결

### 터널이 시작되지 않는 경우

```bash
# 터널 목록 확인
.\cloudflared.exe tunnel list

# 터널 삭제 후 재생성
.\cloudflared.exe tunnel delete maker3d-backend
.\cloudflared.exe tunnel create maker3d-backend
```

### DNS가 작동하지 않는 경우

```bash
# DNS 레코드 확인
nslookup maker3d-backend.cfargotunnel.com

# DNS 레코드 재설정
.\cloudflared.exe tunnel route dns maker3d-backend maker3d-backend.cfargotunnel.com
```

### 백엔드가 연결되지 않는 경우

1. 백엔드 서버가 포트 10000에서 실행 중인지 확인
2. `config.yml`의 `service: http://localhost:10000` 확인
3. 방화벽 설정 확인

---

## 🔄 Windows 시작 시 자동 실행 설정

### 방법 1: Windows 서비스로 등록

```bash
.\cloudflared.exe service install
```

### 방법 2: 작업 스케줄러

1. Windows 검색 > "작업 스케줄러" 실행
2. "기본 작업 만들기" 선택
3. 트리거: "컴퓨터를 시작할 때"
4. 작업: "프로그램 시작"
5. 프로그램: `C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend\cloudflared.exe`
6. 인수: `tunnel --config C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend\config.yml run maker3d-backend`

### 방법 3: 시작 프로그램 폴더

1. `Win + R` > `shell:startup`
2. 배치 파일 생성 `start-tunnel.bat`:

```batch
@echo off
cd C:\Users\rlaal\OneDrive\Desktop\github\maker3d\backend
start "" cloudflared.exe tunnel --config config.yml run maker3d-backend
```

3. 배치 파일을 시작 프로그램 폴더로 이동

---

## 📊 모니터링

### 로그 확인

```bash
.\cloudflared.exe tunnel --config config.yml run maker3d-backend --loglevel debug
```

### Cloudflare Dashboard

https://dash.cloudflare.com/ > Zero Trust > Access > Tunnels에서 실시간 트래픽 확인

---

## 💰 비용

- **Cloudflare Tunnel**: 완전 무료
- **대역폭**: 무제한 무료
- **도메인**: cfargotunnel.com 무료 (커스텀 도메인은 별도 구매 필요)

---

## 🔒 보안

- 모든 트래픽이 HTTPS로 암호화됩니다
- Cloudflare의 DDoS 보호 자동 적용
- 공개 IP 노출 없이 안전하게 서비스 제공
- 외부에서 직접 포트 접근 불가능

---

## 📚 추가 자료

- Cloudflare Tunnel 공식 문서: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- Cloudflare Dashboard: https://dash.cloudflare.com/
- GitHub 이슈: https://github.com/cloudflare/cloudflared/issues

---

## 완료 체크리스트

- [ ] cloudflared.exe 다운로드 및 backend 폴더에 저장
- [ ] `cloudflared tunnel login` 실행하여 인증
- [ ] `cloudflared tunnel create maker3d-backend` 실행하여 터널 생성
- [ ] `config.yml` 파일에 UUID 입력
- [ ] DNS 설정 완료
- [ ] 백엔드 서버 시작 (포트 10000)
- [ ] 터널 시작
- [ ] HTTPS URL로 접속 테스트 성공
- [ ] Vercel 환경변수 업데이트
- [ ] 프론트엔드에서 네이버 스토어 API 호출 테스트 성공
