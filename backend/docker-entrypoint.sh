#!/bin/sh
# 컨테이너가 시작될 때 한 번 실행됩니다.
set -e

DATA=/app/data

if ! [ -w "$DATA" ]; then
  echo "오류: $DATA 에 쓸 수 없습니다. 서버의 데이터 폴더 소유자를 확인하세요 (sudo chown -R 1000:1000 <DATA_DIR>/api)." >&2
  exit 1
fi

# 올라온 파일을 담는 폴더 (없으면 만듦)
for d in uploads temp orders saved-quotes freenoticeboard notices portfolio; do
  mkdir -p "$DATA/$d"
done

# 지난 실행에서 남은 임시 파일 정리 (1시간 넘은 것만)
find "$DATA/temp" "$DATA/uploads" -type f -mmin +60 -delete 2>/dev/null || true

exec "$@"
