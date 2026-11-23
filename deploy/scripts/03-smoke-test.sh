#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# 동작 점검. 페이지가 뜨는지, 백엔드가 견적을 실제로 계산하는지 확인합니다.
# 사용: bash scripts/03-smoke-test.sh                          (서버 안에서. http://127.0.0.1)
#       bash deploy/scripts/03-smoke-test.sh http://<서버 IP>   (내 Mac 에서, 시험 기간)
#       bash deploy/scripts/03-smoke-test.sh https://www.maker3d.kr https://maker3d-backend.maker3d.kr
#                                                              (도메인 연결 후: 사이트 주소, 백엔드 주소)
# 실제 주문이나 글은 만들지 않습니다. 견적 계산용 시험 파일만 올렸다가 지워집니다.
# ──────────────────────────────────────────────────────────────
set -u
WEB="${1:-http://127.0.0.1}"
API="${2:-$WEB/backend}"
fail=0

check() { # check <기대코드> <URL> [설명]
  local want="$1" url="$2" desc="${3:-$2}" code
  code="$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$url")"
  if [ "$code" = "$want" ]; then printf "  OK   %-3s %s\n" "$code" "$desc"
  else printf "  FAIL %-3s (기대 %s) %s\n" "$code" "$want" "$desc"; fail=1; fi
}

echo "사이트: $WEB"
echo "백엔드: $API"
echo "[프론트]"
check 200 "$WEB/"            "메인 페이지"
check 200 "$WEB/quote"       "실시간 견적 페이지"
check 200 "$WEB/store"       "스토어 페이지"
check 200 "$WEB/portfolio"   "포트폴리오 페이지"
check 200 "$WEB/sitemap.xml" "사이트맵"
check 200 "$WEB/_next/image?url=%2Fmainpage.png&w=640&q=75" "이미지 최적화"

echo "[백엔드]"
check 404 "$API/healthz" "백엔드 응답 (없는 주소라 404 가 정상)"

# 견적 계산: 한 변 20mm 정육면체를 만들어 올려 봅니다.
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
{
  echo "solid cube"
  tri() { echo " facet normal 0 0 0"; echo "  outer loop"; echo "   vertex $1"; echo "   vertex $2"; echo "   vertex $3"; echo "  endloop"; echo " endfacet"; }
  A="0 0 0"; B="20 0 0"; C="20 20 0"; D="0 20 0"; E="0 0 20"; F="20 0 20"; G="20 20 20"; H="0 20 20"
  tri "$A" "$C" "$B"; tri "$A" "$D" "$C"   # 바닥
  tri "$E" "$F" "$G"; tri "$E" "$G" "$H"   # 위
  tri "$A" "$B" "$F"; tri "$A" "$F" "$E"   # 앞
  tri "$B" "$C" "$G"; tri "$B" "$G" "$F"   # 오른쪽
  tri "$C" "$D" "$H"; tri "$C" "$H" "$G"   # 뒤
  tri "$D" "$A" "$E"; tri "$D" "$E" "$H"   # 왼쪽
  echo "endsolid cube"
} > "$TMP/cube.stl"
res="$(curl -s -m 200 -F material=PLA -F "stlFile=@$TMP/cube.stl" "$API/api/upload-stl")"
if echo "$res" | grep -q '"success":true'; then
  printf "  OK       견적 계산 (20mm 정육면체, PLA): 출력 시간 %s, %s원\n" \
    "$(echo "$res" | sed -E 's/.*"printTime":"([^"]*)".*/\1/')" \
    "$(echo "$res" | sed -E 's/.*"estimatedPrice":([0-9]+).*/\1/')"
else
  printf "  FAIL     견적 계산: %s\n" "$(echo "$res" | cut -c1-200)"; fail=1
fi

# 서버 안에서 실행한 경우에만: 컨테이너 상태
if command -v docker >/dev/null 2>&1 && docker compose ps >/dev/null 2>&1; then
  echo "[컨테이너]"
  docker compose ps --format '  {{.Name}}\t{{.Status}}'
  bad="$(docker compose ps -a --format '{{.Name}}\t{{.Health}}\t{{.Status}}' | awk -F'\t' '($2!="" && $2!="healthy") || $3!~/^Up/')"
  [ -z "$bad" ] || { echo "  FAIL 비정상 컨테이너: $bad"; fail=1; }
fi

echo
[ "$fail" = 0 ] && echo "모두 통과" || { echo "실패 항목이 있습니다. docker compose logs <서비스명> 으로 확인하세요."; exit 1; }
