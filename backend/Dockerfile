# MAKER3D 백엔드 (Express + 슬라이서)
# 빌드 위치: backend/.  deploy/docker-compose.yml 의 api 서비스가 사용합니다.
#
# 슬라이서는 두 가지가 들어갑니다.
#   OrcaSlicer  : 견적 계산 (QUOTE_SLICER=orca 일 때). 기준 설정은 orca-profiles/
#   PrusaSlicer : 광경화성 레진 견적, 그리고 QUOTE_SLICER=prusa 로 되돌렸을 때

# ───────────── 1단계: Node 와 의존성 ─────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ───────────── 2단계: 오르카 슬라이서 꺼내기 ─────────────
# 공식 배포 파일(AppImage)을 받아 검증한 뒤, 실행하지 않고 안의 파일 묶음만 꺼냅니다.
# (AppImage 를 그대로 실행하려면 FUSE 가 필요한데 컨테이너에는 없습니다)
# 버전을 올릴 때: ORCA_VERSION 과 아래 sha256 두 개를 함께 바꿉니다.
# sha256 은 https://github.com/OrcaSlicer/OrcaSlicer/releases 의 각 파일에 적혀 있습니다.
FROM ubuntu:26.04 AS orca
ARG TARGETARCH
ARG ORCA_VERSION=2.5.2
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl squashfs-tools \
 && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "$TARGETARCH" in \
      amd64) file="OrcaSlicer_Linux_AppImage_Ubuntu2404_V${ORCA_VERSION}.AppImage"; \
             sha="22fa88884dec3fdbd29e90cba9912fcff6fb57a60b1bdc1a6c189c61a6b0a870" ;; \
      arm64) file="OrcaSlicer_Linux_AppImage_Ubuntu2404_aarch64_V${ORCA_VERSION}.AppImage"; \
             sha="297aa2d8a83e8ea0a26b39e383a00f992bc0e3c1076368cad79b35704502a254" ;; \
      *) echo "지원하지 않는 CPU 종류입니다: $TARGETARCH"; exit 1 ;; \
    esac; \
    curl -fsSL --retry 3 -o /tmp/orca.AppImage "https://github.com/OrcaSlicer/OrcaSlicer/releases/download/v${ORCA_VERSION}/${file}"; \
    echo "${sha}  /tmp/orca.AppImage" | sha256sum -c -; \
    # 파일 묶음은 앞쪽 실행 부분(ELF) 바로 뒤에서 시작한다: 섹션 표 위치 + 섹션 수 x 섹션 크기
    offset=$(( $(od -An -tu8 -j40 -N8 /tmp/orca.AppImage) + $(od -An -tu2 -j58 -N2 /tmp/orca.AppImage) * $(od -An -tu2 -j60 -N2 /tmp/orca.AppImage) )); \
    unsquashfs -q -o "$offset" -d /opt/orca /tmp/orca.AppImage; \
    rm /tmp/orca.AppImage; \
    test -x /opt/orca/AppRun

# ───────────── 3단계: 실행 ─────────────
# 우분투 26.04 의 prusa-slicer 패키지는 2.9.4 입니다 (ini/ 설정 파일을 만든 버전과 같음).
# 슬라이서 때문에 alpine 이 아니라 우분투를 씁니다.
FROM ubuntu:26.04
ENV DEBIAN_FRONTEND=noninteractive
# 둘째 묶음은 오르카 슬라이서가 실행될 때 찾는 부품입니다 (화면은 쓰지 않지만 프로그램이 요구함).
RUN apt-get update \
 && apt-get install -y --no-install-recommends prusa-slicer ca-certificates \
      libgtk-3-0t64 libwebkit2gtk-4.1-0 libgl1 libegl1 libopengl0 libglx0 \
      libgstreamer1.0-0 libgstreamer-plugins-base1.0-0 libmspack0t64 libsecret-1-0 libsoup-3.0-0 \
      libwayland-client0 libwayland-egl1 libwayland-server0 libxkbcommon0 libdbus-1-3 libsm6 libice6 libfontconfig1 \
 && rm -rf /var/lib/apt/lists/* \
 && prusa-slicer --help | head -1

COPY --from=orca /opt/orca /opt/orca
RUN /opt/orca/AppRun --help | head -1

COPY --from=deps /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json server.js prusaClicer.js orcaSlicer.js prusa-config.ini docker-entrypoint.sh ./
COPY ini ./ini
COPY orca-profiles ./orca-profiles

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
    ORCA_SLICER_PATH=/opt/orca/AppRun \
    HOME=/tmp

EXPOSE 10000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
