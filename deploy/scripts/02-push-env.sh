#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# 비밀값 보내기. 내 Mac 에서 실행합니다.
# 내 Mac 의 .env.local, backend/.env.local 에서 값을 읽어 서버에 아래 세 파일을 만듭니다.
#   /srv/maker3d/repo/deploy/.env          (주소, 빌드 값)
#   /srv/maker3d/repo/deploy/env/web.env   (메일, GCS)
#   /srv/maker3d/repo/deploy/env/api.env   (네이버 커머스 API)
# 사용: bash deploy/scripts/02-push-env.sh <ssh 별칭>          예) bash deploy/scripts/02-push-env.sh maker3d
#       서버에 이미 있으면 덮어쓰지 않습니다. 덮어쓰려면 끝에 --force
#       --force 는 env/web.env, env/api.env 만 다시 만듭니다 (기존 것은 .bak 으로 남김).
#       주소 설정(.env)은 이미 있으면 건드리지 않습니다.
# 주의: 내 Mac 의 .env.local 값이 운영 값과 다를 수 있습니다.
#       2026-11-23 기준 ADMIN_EMAIL 은 Vercel 운영 값과 달라 서버에서 직접 고쳐 두었습니다.
#       --force 로 다시 보내면 그 값이 내 Mac 의 값으로 되돌아갑니다.
# 값은 화면에 출력하지 않고, Mac 에 사본도 남기지 않습니다.
# ──────────────────────────────────────────────────────────────
set -euo pipefail
HOST="${1:?사용법: bash deploy/scripts/02-push-env.sh <ssh 별칭> [--force]}"
FORCE="${2:-}"
cd "$(dirname "$0")/../.."                 # 저장소 루트
ROOT_ENV=.env.local
API_ENV=backend/.env.local
REMOTE=/srv/maker3d/repo/deploy
[ -f "$ROOT_ENV" ] || { echo "$ROOT_ENV 가 없습니다."; exit 1; }
[ -f "$API_ENV" ]  || { echo "$API_ENV 가 없습니다."; exit 1; }

# 서버 주소: ~/.ssh/config 의 HostName
IP="$(ssh -G "$HOST" | awk '$1=="hostname"{print $2}')"
SITE_URL="https://www.maker3d.kr"

getval() { # getval <파일> <이름>
  grep -E "^$2=" "$1" | head -1 | cut -d= -f2- || true
}
line() { # line <이름> <값>  →  이름='값'   (작은따옴표: $ 와 공백이 든 값도 그대로 전달)
  case "$2" in *"'"*) echo "오류: $1 값에 작은따옴표가 있어 자동으로 만들 수 없습니다." >&2; exit 1;; esac
  printf "%s='%s'\n" "$1" "$2"
}
warn=0
need() { # need <파일> <이름>
  [ -n "$(getval "$1" "$2")" ] || { echo "경고: $1 에 $2 가 없습니다. 빈 값으로 보냅니다."; warn=1; }
}
need "$ROOT_ENV" EMAIL_USER; need "$ROOT_ENV" EMAIL_PASS; need "$ROOT_ENV" ADMIN_EMAIL
need "$API_ENV" NAVER_CLIENT_ID; need "$API_ENV" NAVER_CLIENT_SECRET

if [ "$FORCE" != "--force" ] && ssh "$HOST" "test -f $REMOTE/.env -o -f $REMOTE/env/web.env -o -f $REMOTE/env/api.env"; then
  echo "서버에 이미 env 파일이 있습니다. 덮어쓰려면 끝에 --force 를 붙이세요."
  exit 1
fi
ssh "$HOST" "mkdir -p $REMOTE/env && chmod 700 $REMOTE/env"
# 덮어쓰기 전에 서버의 기존 파일을 .bak 으로 남김
ssh "$HOST" "cd $REMOTE && for f in env/web.env env/api.env; do [ -f \$f ] && cp -p \$f \$f.bak; done; true"

send() { # 표준입력을 서버 파일로 (권한 600)
  ssh "$HOST" "umask 077 && cat > $1"
}

# 주소 설정(.env)은 처음 한 번만 만듭니다.
# 이미 있으면 --force 여도 건드리지 않습니다 (운영 주소로 바꿔 둔 설정을 시험용으로 되돌리지 않기 위해).
if ssh "$HOST" "test -f $REMOTE/.env"; then
  echo "주소 설정($REMOTE/.env)은 이미 있어 건드리지 않습니다."
else
{
  echo "# 02-push-env.sh 가 만든 파일. 설명은 .env.example 참고."
  echo "DATA_DIR=/srv/maker3d/data"
  echo
  echo "# [시험 기간] http://$IP 로 접속. 백엔드는 /backend 아래."
  echo "WEB_SITE=:80"
  echo "API_SITE=:8080"
  echo "NEXT_PUBLIC_SITE_URL=$SITE_URL"
  echo "NEXT_PUBLIC_BACKEND_URL=http://$IP/backend"
  echo
  echo "# [도메인 연결 후] 위 네 줄을 아래로 바꾸고  docker compose up -d --build"
  echo "# WEB_SITE=www.maker3d.kr"
  echo "# API_SITE=maker3d-backend.maker3d.kr"
  echo "# APEX_SITE=maker3d.kr"
  echo "# NEXT_PUBLIC_SITE_URL=$SITE_URL"
  echo "# NEXT_PUBLIC_BACKEND_URL=https://maker3d-backend.maker3d.kr"
  echo
  line NEXT_PUBLIC_NAVER_PAY_CLIENT_ID "$(getval "$ROOT_ENV" NEXT_PUBLIC_NAVER_PAY_CLIENT_ID)"
  line NEXT_PUBLIC_NAVER_PAY_CHAIN_ID  "$(getval "$ROOT_ENV" NEXT_PUBLIC_NAVER_PAY_CHAIN_ID)"
} | send "$REMOTE/.env"
fi

{
  line EMAIL_USER  "$(getval "$ROOT_ENV" EMAIL_USER)"
  line EMAIL_PASS  "$(getval "$ROOT_ENV" EMAIL_PASS)"
  line ADMIN_EMAIL "$(getval "$ROOT_ENV" ADMIN_EMAIL)"
  line NEXTAUTH_URL "$SITE_URL"
  line GOOGLE_CLOUD_PROJECT_ID  "$(getval "$ROOT_ENV" GOOGLE_CLOUD_PROJECT_ID)"
  line GOOGLE_CLOUD_BUCKET_NAME "$(getval "$ROOT_ENV" GOOGLE_CLOUD_BUCKET_NAME)"
  line GOOGLE_APPLICATION_CREDENTIALS_JSON "$(getval "$ROOT_ENV" GOOGLE_APPLICATION_CREDENTIALS_JSON)"
} | send "$REMOTE/env/web.env"

{
  line NAVER_CLIENT_ID     "$(getval "$API_ENV" NAVER_CLIENT_ID)"
  line NAVER_CLIENT_SECRET "$(getval "$API_ENV" NAVER_CLIENT_SECRET)"
} | send "$REMOTE/env/api.env"

echo "보냄: $HOST:$REMOTE/.env, env/web.env, env/api.env"
ssh "$HOST" "cd $REMOTE && wc -l .env env/web.env env/api.env | sed 's/^/  /'"
[ "$warn" = 0 ] || echo "경고가 있습니다. 위 내용을 확인하세요."
