# MAKER3D 백엔드 (Express + PrusaSlicer)
# 빌드 위치: backend/.  deploy/docker-compose.yml 의 api 서비스가 사용합니다.

# ───────────── 1단계: Node 와 의존성 ─────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ───────────── 2단계: 실행 ─────────────
# 우분투 26.04 의 prusa-slicer 패키지는 2.9.4 입니다 (ini/ 설정 파일을 만든 버전과 같음).
# 슬라이서 때문에 alpine 이 아니라 우분투를 씁니다.
FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends prusa-slicer ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && prusa-slicer --help | head -1

COPY --from=deps /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js prusaClicer.js prusa-config.ini docker-entrypoint.sh ./
COPY ini ./ini

# 올라온 파일은 전부 /app/data (서버 디스크에 연결되는 폴더) 한 곳에 둡니다.
# 코드는 /app/orders 같은 경로를 쓰므로 바로가기(symlink)로 이어 줍니다.
# 한 폴더에 모으는 이유: 임시 폴더(temp)에서 주문 폴더로 파일을 "옮길" 때
# 서로 다른 연결 지점이면 옮기기가 실패하기 때문입니다.
RUN chmod 755 docker-entrypoint.sh \
 && mkdir data \
 && for d in uploads temp orders saved-quotes freenoticeboard notices portfolio; do ln -s "data/$d" "$d"; done \
 && chown ubuntu:ubuntu data

# root 가 아닌 사용자(uid 1000)로 실행. 서버의 ubuntu 계정과 번호가 같아 data 폴더를 그대로 쓸 수 있습니다.
USER ubuntu
ENV NODE_ENV=production \
    PORT=10000 \
    PRUSA_SLICER_PATH=/usr/bin/prusa-slicer \
    HOME=/tmp

EXPOSE 10000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
