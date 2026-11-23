# MAKER3D 서버 배포 가이드

프론트(Next.js)와 백엔드(Express + PrusaSlicer)를 Docker 로 묶어 **AWS Lightsail 서버 한 대**에서 돌리는 방법입니다.
이 폴더(`deploy/`)에 서버에서 쓰는 compose · Caddy 설정과 단계별 스크립트가 들어 있습니다.

> **2026-11-23 전환 완료.** `www.maker3d.kr` 과 `maker3d-backend.maker3d.kr` 은 이 서버에서 돌아갑니다.
> 평소에는 [9. 평상시 운영](#9-평상시-운영)만 보면 됩니다. 1~8번은 처음 세울 때의 기록이자, 서버를 새로 만들 때의 절차입니다.

## 0. 한눈에 보기

| 항목 | 값 |
|---|---|
| 서버 | AWS Lightsail 서울, Ubuntu 24.04, 2 vCPU / 4GB / 80GB, 고정 IP `54.116.201.3` |
| 주소 | 사이트 `https://www.maker3d.kr` (`maker3d.kr` 은 www 로 넘김), 백엔드 `https://maker3d-backend.maker3d.kr` |
| DNS | Cloudflare (도메인 등록은 호스팅kr). 레코드 3개 모두 A `54.116.201.3`, 프록시 끔(DNS only) |
| 접속 | `ssh maker3d` |
| 코드 위치 | `/srv/maker3d/repo` (이 저장소 clone) |
| 데이터 위치 | `/srv/maker3d/data/api` (주문 · 저장 견적 · 게시판/공지 첨부 · 포트폴리오), `/srv/maker3d/data/caddy` (인증서) |
| 비밀값 위치 | `/srv/maker3d/repo/deploy/.env`, `deploy/env/*.env` (git 제외, 권한 600) |
| 실행 | `cd /srv/maker3d/repo/deploy && docker compose up -d --build` |

컨테이너는 세 개입니다.

| 이름 | 하는 일 |
|---|---|
| `maker3d-caddy` | 입구. 80/443 을 받아 프론트 · 백엔드로 나눠 보내고 HTTPS 인증서를 자동 발급 |
| `maker3d-web` | 프론트엔드 (Next.js) |
| `maker3d-api` | 백엔드 (견적 계산, 파일 보관, 네이버 스토어 연동) |

## 1. 준비물

| 준비물 | 누가 | 비고 |
|---|---|---|
| Lightsail 인스턴스 + 고정 IP + `.pem` 키 | 사용자 | Ubuntu 24.04 LTS, 월 24달러 플랜, 자동 스냅샷 켜기, 방화벽 22/80/443 |
| Cloudflare 의 `maker3d.kr` DNS 변경 권한 | 사용자 | 8단계(전환)에서 레코드 2개를 바꿈 |
| 네이버 커머스API센터 로그인 | 사용자 | 8단계에서 새 서버 IP 를 "API호출 IP" 에 등록 |
| 지금 백엔드가 도는 윈도우 PC | 사용자 | 8단계에서 올라온 파일 폴더를 서버로 복사 |

## 2. 내 Mac 설정 (1회)

`~/.ssh/config` 에 서버를 추가합니다.

```
Host maker3d
    HostName <고정 IP>
    User ubuntu
    IdentityFile ~/.ssh/<키 이름>.pem
```

```bash
chmod 400 ~/.ssh/<키 이름>.pem
ssh maker3d 'echo ok'          # 접속 확인
```

## 3. 새 서버 준비 (1회)

```bash
scp deploy/scripts/01-server-setup.sh maker3d:~/
ssh maker3d sudo bash 01-server-setup.sh
```

스크립트가 하는 일: 시간대(서울), 패키지 업데이트, Docker 설치, 스왑 2GB, 방화벽, 자동 보안 업데이트, `/srv/maker3d` 폴더.

## 4. 코드 받기 (1회)

저장소가 공개라서 키 등록 없이 받을 수 있습니다.

```bash
ssh maker3d
git clone https://github.com/nolang1308/maker3d.git /srv/maker3d/repo
```

## 5. 비밀값 보내기 (1회, 내 Mac 에서)

```bash
bash deploy/scripts/02-push-env.sh maker3d
```

내 Mac 의 `.env.local`, `backend/.env.local` 에서 값을 읽어 서버에 `deploy/.env`, `deploy/env/web.env`, `deploy/env/api.env` 를 만듭니다.
값은 화면에 출력되지 않습니다. 처음에는 **시험 기간용 주소**(IP 로 접속)로 만들어집니다.

## 6. 띄우기 · 점검

```bash
ssh maker3d
cd /srv/maker3d/repo/deploy
docker compose up -d --build         # 처음엔 빌드로 5~10분
bash scripts/03-smoke-test.sh        # "모두 통과" 가 나오면 완성
```

브라우저에서 `http://<고정 IP>` 로 접속하면 사이트가 보입니다. 백엔드는 `http://<고정 IP>/backend` 아래에 있습니다.

## 7. 시험 기간에 알아둘 것

- 시험 주소의 사이트도 **운영 중인 Firebase(주문 · 회원 · 게시글)를 그대로 씁니다.** 화면을 둘러보고 견적을 내 보는 것은 괜찮지만, 실제 주문이나 글은 넣지 마세요. 올린 파일이 새 서버에만 저장되어 운영 사이트에서는 열리지 않습니다.
- 포트폴리오 이미지와 예전 첨부 파일은 8단계에서 파일을 옮기기 전까지 보이지 않습니다.
- 스토어 상품 목록은 8단계에서 네이버에 새 IP 를 등록하기 전까지 오류가 납니다.
- 로그인(구글 등)은 도메인이 연결되어야 정상 동작합니다.

## 8. 전환 (운영 주소를 새 서버로)

> 2026-11-23 실제 전환은 아래와 조금 다르게 했습니다. DNS 를 관리하던 예전 Cloudflare 계정에 들어갈 수 없어서,
> 새 Cloudflare 계정에 도메인을 추가하고 호스팅kr 에서 **네임서버를 바꾸는 방식**으로 넘겼습니다.
> 넘어오기 전에는 `.env` 에 `REHEARSAL_TLS="tls internal"` 을 넣어 자체 서명 인증서로 미리 확인했고,
> 등록소에 반영된 뒤 그 줄을 지워 정식 인증서를 받았습니다. 주소 설정을 다시 바꿀 일이 생기면 같은 방법을 쓰면 됩니다.

순서대로 합니다. 3번 전까지는 운영 사이트에 아무 영향이 없습니다.

**1) 올라온 파일 옮기기.** 지금 백엔드가 도는 윈도우 PC 의 `backend` 폴더에서 (PowerShell):

```powershell
scp -i <키 파일>.pem -r orders notices portfolio saved-quotes freenoticeboard ubuntu@<고정 IP>:/srv/maker3d/data/api/
```

**2) 네이버에 새 IP 등록.** 커머스API센터 → 애플리케이션 → 수정 → API호출 IP 에 `<고정 IP>` 추가. 기존 PC 의 IP 는 되돌릴 때를 위해 당분간 남겨 둡니다.

**3) 주소를 도메인으로 바꾸고 다시 빌드.** 서버에서 `deploy/.env` 의 주소 네 줄을 "도메인 연결 후" 값으로 바꿉니다.

```bash
ssh maker3d
cd /srv/maker3d/repo/deploy
nano .env                            # WEB_SITE, API_SITE, NEXT_PUBLIC_BACKEND_URL 을 도메인 값으로
docker compose up -d --build
```

**4) DNS 변경.** Cloudflare 에서 `www` 와 `maker3d-backend` 레코드를 **A 레코드 = `<고정 IP>`, 프록시 끔(DNS only, 회색 구름)** 으로 바꿉니다. 바꾸기 전 값은 적어 두세요(되돌릴 때 필요).

**5) 확인.** 1~5분 뒤:

```bash
docker compose logs -f caddy         # "certificate obtained successfully" 가 두 도메인에 대해 나오는지
bash deploy/scripts/03-smoke-test.sh https://www.maker3d.kr https://maker3d-backend.maker3d.kr   # 내 Mac 에서
```

**되돌리기**: Cloudflare 에서 두 레코드를 적어 둔 예전 값으로 돌리면 끝입니다. Vercel 과 PC 백엔드는 그대로 살아 있습니다. 단, 전환 뒤 새 서버에 올라온 파일은 수동으로 옮겨야 하므로 판단은 빨리 합니다.

## 9. 평상시 운영

**배포** (코드 수정 후 반영). 내 Mac 에서 커밋 · push 한 뒤:

```bash
ssh maker3d 'cd /srv/maker3d/repo && git pull && cd deploy && docker compose up -d --build'
```

바뀐 쪽만 다시 빌드됩니다. 빌드 중에도 기존 컨테이너는 계속 서비스하고, 끝난 순간에만 잠깐 교체됩니다.

**상태 · 로그**

```bash
cd /srv/maker3d/repo/deploy
docker compose ps
docker compose logs -f --tail 100 web        # 프론트
docker compose logs -f --tail 100 api        # 백엔드 (견적 계산, 업로드)
docker compose logs -f --tail 100 caddy      # 접속 · 인증서
```

**재시작**

```bash
docker compose restart api                   # 하나만
docker compose restart                       # 전부
```

**이전 버전으로 되돌리기**

```bash
cd /srv/maker3d/repo
git log --oneline -5
git checkout <커밋해시>
cd deploy && docker compose up -d --build
# 정상 확인 후 최신으로:  cd /srv/maker3d/repo && git checkout main && git pull && cd deploy && docker compose up -d --build
```

**비밀값 · 주소 바꾸기**

```bash
cd /srv/maker3d/repo/deploy
nano env/web.env                             # 메일, GCS
nano env/api.env                             # 네이버 커머스 API
docker compose up -d                         # 바뀐 env 를 쓰는 컨테이너만 재생성
```

`.env` 의 `NEXT_PUBLIC_...` 값은 화면 코드에 박히는 값이라, 바꾼 뒤에는 `docker compose up -d --build` 로 다시 빌드해야 반영됩니다.

**백업**: Lightsail 콘솔 → 인스턴스 → Snapshots 의 자동 스냅샷(매일). 올라온 파일만 따로 받으려면 내 Mac 에서:

```bash
rsync -av maker3d:/srv/maker3d/data/api/ ~/maker3d-files-backup/
```

**디스크 정리** (몇 달에 한 번)

```bash
df -h /
docker image prune -f
docker builder prune -f --keep-storage 5GB
```

## 10. 하지 말아야 할 것

- `docker compose down -v` : 평소엔 `restart` 나 `up -d` 로 충분합니다.
- `/srv/maker3d/data` 안의 파일 직접 삭제 · 이동 : 고객이 올린 주문 파일과 인증서입니다.
- `deploy/.env`, `deploy/env/*.env` 를 git 에 올리기 : `.gitignore` 로 막혀 있지만 강제로 올리지 마세요. 이 저장소는 공개입니다.

## 참고: 견적 계산

- 서버의 PrusaSlicer 는 2.9.4 입니다 (`backend/ini/` 설정을 만든 버전과 같음).
- 계산 제한 시간은 3분입니다 (`.env` 의 `SLICE_TIMEOUT_MS` 로 조정). 서버 CPU 가 데스크탑보다 느려서 큰 모델에 여유를 둔 값입니다.
- 계산에 쓴 G-code 는 끝나면 지웁니다. 확인용으로 남기려면 `env/api.env` 에 `KEEP_GCODE='1'`.
